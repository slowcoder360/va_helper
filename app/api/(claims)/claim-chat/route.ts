import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { createLogger } from "@/lib/logging";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { getFormattedVAContextPrivate } from "@/lib/context";
import { db } from "@/lib/db";
import { claimChats, claimMessages, userProfiles, disabilities, serviceHistories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { 
  claimChatTools,
  getVeteranProfileTool,
  searchRegulationsTool,
  getClaimStatusTool,
  searchVAKnowledgeTool,
  searchByConditionTool,
  calculateCombinedRatingTool,
  estimateRatingImpactTool
} from "./tools";

const logger = createLogger('ClaimChatAPI');

// ============================================
// Rate Limiting (in-memory, per-user)
// ============================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max requests per window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================
// Request Validation
// ============================================
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().optional(),
    content: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    agent: z.string().optional(),
  })).default([]),
  userId: z.string().min(1, "userId is required"),
  claimChatId: z.string().optional(),
  stream: z.boolean().optional().default(false),
});

// ============================================
// Conversation Memory Limits
// ============================================
const MAX_HISTORY_MESSAGES = 50; // Load at most 50 messages from history

// Build system prompt with ANONYMIZED veteran context
// PII (names, SSN, dates) stays in DB - AI only sees what's needed for regulation matching
async function buildSystemPrompt(userId: string): Promise<string> {
  let veteranContext = "";
  
  try {
    // Fetch veteran profile - only include NON-IDENTIFYING data relevant to claims
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    if (profile) {
      // Only include rating info - not name, SSN, DOB, etc.
      veteranContext += `\n\n## Veteran's Current Status (Anonymized)
- Combined Disability Rating: ${profile.combinedDisabilityRating ?? "Not on file"}%`;
    }
    
    // Fetch service history - only branch and discharge type matter for eligibility
    const services = await db
      .select()
      .from(serviceHistories)
      .where(eq(serviceHistories.userId, userId));
    
    if (services.length > 0) {
      veteranContext += `\n\n### Service Background:`;
      for (const svc of services) {
        // No specific dates - just branch and discharge status (affects eligibility)
        veteranContext += `\n- Branch: ${svc.branchOfService}, Discharge: ${svc.dischargeStatus || "Unknown"}`;
      }
    }
    
    // Fetch existing disabilities - conditions and ratings matter, not personal details
    const disabilityRecords = await db
      .select()
      .from(disabilities)
      .where(eq(disabilities.userId, userId));
    
    if (disabilityRecords.length > 0) {
      veteranContext += `\n\n### Current Service-Connected Conditions:`;
      for (const d of disabilityRecords) {
        // Condition name, rating, diagnostic code - all relevant for claims guidance
        veteranContext += `\n- ${d.name}: ${d.disabilityRating}% (Diagnostic Code: ${d.diagnosticCode || "N/A"})`;
      }
    }
  } catch (error) {
    logger.warn("Failed to fetch veteran context", { userId, error });
  }
  
  return `You are a knowledgeable VA Claims Assistant helping veterans understand the disability claims process.

## Your Role
- Explain VA regulations (38 CFR) and rating criteria
- Help veterans understand evidence requirements
- Guide through claims process and procedures
- Answer questions about appeals and timelines

## Privacy Design
- You receive ONLY condition/rating data - never names, SSNs, or personal identifiers
- Personal details are handled separately in the application layer
- Focus on matching CONDITIONS to REGULATIONS, not individuals to claims

## Your Capabilities (Tools)
- Search VA regulations for specific rating criteria
- Look up diagnostic codes and rating schedules  
- Find procedural requirements in 38 CFR
- Check veteran's existing conditions/ratings (anonymized)

## Guidelines
- Cite specific CFR sections when discussing criteria
- Explain what evidence typically supports claims
- Acknowledge uncertainty rather than guessing
- Recommend VSO consultation for complex situations
- Never provide legal advice

## Key VA Claims Concepts
- Ratings: 0-100% in 10% increments
- Combined ratings use VA math (not simple addition)
- Service connection requires: (1) diagnosis, (2) in-service event, (3) nexus
- Secondary conditions can be service-connected if caused by primary condition

Use your tools to look up specific regulations rather than relying on memory.${veteranContext}`;
}

// Database persistence functions
async function getOrCreateClaimChat(userId: string, claimChatId?: string): Promise<{ id: number; isNew: boolean }> {
  if (claimChatId) {
    const chatId = parseInt(claimChatId, 10);
    if (!isNaN(chatId)) {
      const [existing] = await db
        .select()
        .from(claimChats)
        .where(eq(claimChats.id, chatId))
        .limit(1);
      
      if (existing && existing.userId === userId) {
        return { id: existing.id, isNew: false };
      }
    }
  }
  
  // Create new chat
  const [newChat] = await db
    .insert(claimChats)
    .values({
      userId,
      status: "in_progress",
    })
    .returning();
  
  return { id: newChat.id, isNew: true };
}

async function loadMessageHistory(chatId: number, limit: number = MAX_HISTORY_MESSAGES): Promise<BaseMessage[]> {
  // Load most recent messages up to the limit
  const messages = await db
    .select()
    .from(claimMessages)
    .where(eq(claimMessages.claimChatId, chatId))
    .orderBy(desc(claimMessages.createdAt))
    .limit(limit);
  
  // Reverse to get chronological order
  messages.reverse();
  
  return messages.map(msg => {
    if (msg.role === "user") {
      return new HumanMessage({ content: msg.content });
    } else {
      return new AIMessage({ content: msg.content });
    }
  });
}

async function saveMessage(chatId: number, role: "user" | "system", content: string): Promise<void> {
  await db.insert(claimMessages).values({
    claimChatId: chatId,
    role,
    content,
  });
}

async function updateChatTimestamp(chatId: number): Promise<void> {
  await db
    .update(claimChats)
    .set({ updatedAt: new Date() })
    .where(eq(claimChats.id, chatId));
}

// Initialize the LLM with tool calling
const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
}).bindTools(claimChatTools);

// Streaming-capable LLM (no tools bound, for final response only)
const streamingLlm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  streaming: true,
});

// Helper function to convert LangChain messages to the format expected by the frontend
function convertToClientMessages(messages: BaseMessage[]) {
  return messages
    .filter(msg => msg._getType() !== "system") // Don't send system messages to client
    .map((msg, index) => ({
      id: `msg_${index}`,
      role: msg._getType() === "human" ? "user" : "assistant",
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    }));
}

// Process tool calls if any
async function processToolCalls(response: AIMessage, userId: string): Promise<string | null> {
  if (!response.tool_calls || response.tool_calls.length === 0) {
    return null;
  }
  
  const toolResults: string[] = [];
  
  for (const toolCall of response.tool_calls) {
    logger.info("Executing tool call", { tool: toolCall.name, args: toolCall.args });
    
    try {
      let result: string;
      // Tool args can contain various types - use unknown and validate per-tool
      const args = toolCall.args as Record<string, unknown>;
      
      switch (toolCall.name) {
        case "get_veteran_profile":
          result = await getVeteranProfileTool.invoke({ userId });
          break;
        case "search_va_regulations":
          result = await searchRegulationsTool.invoke({ 
            query: String(args.query || ""), 
            part: args.part ? String(args.part) : undefined 
          });
          break;
        case "get_claim_status":
          result = await getClaimStatusTool.invoke({ userId });
          break;
        case "search_va_knowledge":
          result = await searchVAKnowledgeTool.invoke({ query: String(args.query || "") });
          break;
        case "search_condition_criteria":
          result = await searchByConditionTool.invoke({ condition: String(args.condition || "") });
          break;
        case "calculate_combined_rating":
          result = await calculateCombinedRatingTool.invoke({ 
            ratings: Array.isArray(args.ratings) ? args.ratings : [],
            includeBilateralFactor: typeof args.includeBilateralFactor === "boolean" ? args.includeBilateralFactor : undefined,
            bilateralRatings: Array.isArray(args.bilateralRatings) ? args.bilateralRatings : undefined,
          });
          break;
        case "estimate_rating_impact":
          result = await estimateRatingImpactTool.invoke({
            currentRatings: Array.isArray(args.currentRatings) ? args.currentRatings : [],
            potentialRatings: Array.isArray(args.potentialRatings) ? args.potentialRatings : undefined,
          });
          break;
        default:
          result = JSON.stringify({ error: "Unknown tool" });
      }
      
      toolResults.push(`[${toolCall.name}]: ${result}`);
    } catch (error) {
      logger.error("Tool execution failed", { tool: toolCall.name, error });
      toolResults.push(`[${toolCall.name}]: Error executing tool`);
    }
  }
  
  return toolResults.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body with Zod
    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      logger.warn("Invalid request body", { errors: parseResult.error.flatten() });
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
    const { messages, userId, claimChatId, stream } = parseResult.data;
    
    // Rate limiting check
    if (!checkRateLimit(userId)) {
      logger.warn("Rate limit exceeded", { userId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before sending another message." },
        { status: 429 }
      );
    }
    
    logger.info("Received chat request", { 
      userId, 
      claimChatId,
      messageCount: messages?.length || 0
    });
    
    // Get or create claim chat (DB persistence)
    const { id: chatId, isNew } = await getOrCreateClaimChat(userId, claimChatId);
    logger.info("Claim chat resolved", { chatId, isNew });
    
    // Check if this is a history request (empty messages array)
    if (!messages || messages.length === 0) {
      logger.info("History request detected", { chatId });
      
      const storedMessages = await loadMessageHistory(chatId);
      const clientMessages = convertToClientMessages(storedMessages);
      
      return NextResponse.json({
        messages: clientMessages,
        claimChatId: chatId.toString()
      });
    }
    
    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];
    if (!latestUserMessage || latestUserMessage.role !== "user") {
      const storedMessages = await loadMessageHistory(chatId);
      return NextResponse.json({
        messages: convertToClientMessages(storedMessages),
        claimChatId: chatId.toString()
      });
    }
    
    const userQuery = latestUserMessage.content;
    logger.info("Processing user query", { chatId, queryLength: userQuery.length });
    const startTime = Date.now();
    
    // Load existing message history from DB
    const storedMessages = await loadMessageHistory(chatId);
    
    // Build system prompt with veteran context
    const systemPrompt = await buildSystemPrompt(userId);
    
    // Retrieve relevant VA context using privacy-preserving RAG (HyDE)
    // User's raw query is NOT sent to embedding API - a hypothetical answer is generated first
    let vaContext = "";
    try {
      vaContext = await getFormattedVAContextPrivate(userQuery, 3000);
      if (vaContext) {
        logger.info("Retrieved VA context (privacy-preserving)", { contextLength: vaContext.length });
      }
    } catch (error) {
      logger.warn("Failed to retrieve VA context", { error });
    }
    
    // Build message history for LLM
    const messageHistory: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...storedMessages,
    ];
    
    // Add context-augmented user message
    const contextAugmentedQuery = vaContext 
      ? `${userQuery}\n\n---\n[Relevant VA Information Retrieved]\n${vaContext}`
      : userQuery;
    
    messageHistory.push(new HumanMessage({ content: contextAugmentedQuery }));
    
    // Generate response with potential tool calls
    let response = await llm.invoke(messageHistory);
    logger.info("Initial LLM response", { 
      hasToolCalls: (response.tool_calls?.length || 0) > 0,
      toolCalls: response.tool_calls?.map(tc => tc.name)
    });
    
    // Process tool calls if any (up to 3 iterations to prevent infinite loops)
    let iterations = 0;
    while (response.tool_calls && response.tool_calls.length > 0 && iterations < 3) {
      iterations++;
      
      const toolResults = await processToolCalls(response, userId);
      if (toolResults) {
        messageHistory.push(response);
        messageHistory.push(new HumanMessage({ 
          content: `Tool results:\n${toolResults}\n\nPlease incorporate this information into your response to the user.`
        }));
        
        response = await llm.invoke(messageHistory);
        logger.info("Follow-up LLM response", { iteration: iterations });
      } else {
        break;
      }
    }
    
    // ---- Streaming path ----
    if (stream) {
      // Save the user message first
      await saveMessage(chatId, "user", userQuery);
      
      // If tool calls already produced a final answer, stream it directly
      const hasToolContent = iterations > 0 && typeof response.content === "string" && response.content.length > 0;
      
      if (hasToolContent) {
        // Stream the pre-generated tool-assisted response
        const finalContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        await saveMessage(chatId, "system", finalContent);
        await updateChatTimestamp(chatId);
        
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(finalContent));
            controller.close();
          },
        });
        
        return new Response(readableStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Claim-Chat-Id": chatId.toString(),
          },
        });
      }
      
      // Stream the final LLM response
      const streamResponse = await streamingLlm.stream(messageHistory);
      let fullContent = "";
      
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse) {
              const text = typeof chunk.content === "string" ? chunk.content : "";
              if (text) {
                fullContent += text;
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
            
            // Save complete message to DB after stream finishes
            await saveMessage(chatId, "system", fullContent);
            await updateChatTimestamp(chatId);
            logger.info("Streaming complete", { chatId, contentLength: fullContent.length });
          } catch (err) {
            logger.error("Streaming error", { error: err });
            controller.error(err);
          }
        },
      });
      
      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Claim-Chat-Id": chatId.toString(),
        },
      });
    }
    
    // ---- Non-streaming path (default) ----
    // Extract final response content
    const finalContent = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    // Save messages to database (persist the conversation)
    await saveMessage(chatId, "user", userQuery);
    await saveMessage(chatId, "system", finalContent);
    await updateChatTimestamp(chatId);
    
    const duration = Date.now() - startTime;
    logger.info("Message processing complete", { 
      chatId, 
      duration,
      toolIterations: iterations
    });
    
    // Load updated messages and return
    const updatedMessages = await loadMessageHistory(chatId);
    const clientMessages = convertToClientMessages(updatedMessages);
    
    return NextResponse.json({
      messages: clientMessages,
      claimChatId: chatId.toString()
    });
    
  } catch (error) {
    logger.error("Error processing chat request", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
