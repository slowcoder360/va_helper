import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { claimChats, claimMessages, userProfiles, disabilities } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

// LangChain and tools imports
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";

// ----------------- Tools -----------------
const updateUserProfileTool = new DynamicStructuredTool({
  name: "update_user_profile",
  description: "Update fields in a user's profile.",
  schema: z.object({
    userId: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }),
  func: async (data) => {
    const { userId, ...updates } = data;
    try {
      await db.update(userProfiles)
        .set(updates)
        .where(eq(userProfiles.userId, userId));
      return "User profile updated successfully.";
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      return "Error updating user profile.";
    }
  },
});

const updateDisabilityRatingTool = new DynamicStructuredTool({
  name: "update_disability_rating",
  description: "Update the disability rating for a user.",
  schema: z.object({
    userId: z.string(),
    disabilityName: z.string(),
    newRating: z.number(),
  }),
  func: async ({ userId, disabilityName, newRating }) => {
    try {
      await db.update(disabilities)
        .set({ disabilityRating: newRating })
        .where(and(
          eq(disabilities.userId, userId),
          eq(disabilities.name, disabilityName)
        ));
      return `Disability rating for ${disabilityName} updated to ${newRating}.`;
    } catch (error: any) {
      console.error("Error updating disability rating:", error);
      return "Error updating disability rating.";
    }
  },
});

const fetchUserProfileTool = new DynamicStructuredTool({
  name: "fetch_user_profile",
  description: "Fetch user profile by userId.",
  schema: z.object({
    userId: z.string()
  }),
  func: async ({ userId }) => {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    if (!profile) return "No profile found.";
    return JSON.stringify(profile);
  },
});

// ----------------- Helper: Store Messages -----------------
async function storeMessageInClaimThread(claimChatId: number, role: "user" | "system", content: string) {
  await db.insert(claimMessages).values({
    claimChatId,
    content,
    role,
  });
}

// ----------------- Agent Setup -----------------
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0,
});

const supervisorAgent = createReactAgent({
  llm,
  tools: [updateUserProfileTool, updateDisabilityRatingTool, fetchUserProfileTool],
  messageModifier: new SystemMessage("You are an assistant that can update user profiles and disability ratings using the provided tools. You also help with claim-related questions.")
});

async function runClaimAgents(userMessage: string, claimChatId: number, userId: string) {
  // Fetch conversation history
  const previousMessages = await db.select()
    .from(claimMessages)
    .where(eq(claimMessages.claimChatId, claimChatId))
    .orderBy(asc(claimMessages.createdAt));

  const conversation = previousMessages.map((m) =>
    m.role === "user"
      ? new HumanMessage({ content: m.content })
      : new SystemMessage({ content: m.content })
  );

  // Add new user message
  conversation.push(new HumanMessage({ content: userMessage }));

  // Invoke the agent
  const result = await supervisorAgent.invoke({ messages: conversation });
  const lastMessage = result.messages[result.messages.length - 1];

  if (lastMessage) {
    await storeMessageInClaimThread(claimChatId, "system", lastMessage.content);
    return lastMessage.content;
  } else {
    return "No response generated.";
  }
}

// ----------------- Route Handlers -----------------
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const claimChatId = parseInt(searchParams.get("claimChatId") || "", 10);
  if (!claimChatId) {
    return NextResponse.json({ error: "Missing claimChatId" }, { status: 400 });
  }

  // Verify ownership
  const [chat] = await db.select().from(claimChats).where(eq(claimChats.id, claimChatId));
  if (!chat || chat.userId !== userId) {
    return NextResponse.json({ error: "Not authorized or chat not found" }, { status: 403 });
  }

  const messagesData = await db.select()
    .from(claimMessages)
    .where(eq(claimMessages.claimChatId, claimChatId))
    .orderBy(asc(claimMessages.createdAt));

  // Transform messages to {id, content, role} suitable for your frontend
  const formatted = messagesData.map((m) => ({
    id: m.id.toString(),
    content: m.content,
    role: m.role === "user" ? "user" : "assistant"
  }));

  return NextResponse.json(formatted, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userMessage, claimChatId } = body as {
    userMessage: string;
    claimChatId?: number;
  };

  if (!userMessage) {
    return NextResponse.json({ error: "Missing userMessage" }, { status: 400 });
  }

  if (!claimChatId) {
    return NextResponse.json({ error: "Missing claimChatId" }, { status: 400 });
  }

  const [chat] = await db.select().from(claimChats).where(eq(claimChats.id, claimChatId));
  if (!chat || chat.userId !== userId) {
    return NextResponse.json({ error: "Not authorized or chat not found" }, { status: 403 });
  }

  // Store the user's message
  await storeMessageInClaimThread(claimChatId, "user", userMessage);

  // Run the agent
  const response = await runClaimAgents(userMessage, claimChatId, userId);

  return NextResponse.json({ response, claimChatId }, { status: 200 });
}
