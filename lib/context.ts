import { Pinecone } from "@pinecone-database/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { convertToAscii } from "./utils";
import { getEmbeddings } from "./embeddings";

const PINECONE_INDEX = "va-helper";
const VA_KNOWLEDGE_NAMESPACE = "va-knowledge-base";
const VA_KNOWLEDGE_NAMESPACE_V3 = "va-knowledge-v3"; // Enhanced indexing

// ============================================
// HyDE (Hypothetical Document Embeddings)
// ============================================
// Instead of embedding raw user queries (which may contain PII),
// we generate a hypothetical answer and embed that instead.
// Benefits:
// 1. Privacy: No PII sent to embedding API
// 2. Better retrieval: Hypothetical answers are closer to indexed documents
// 3. Audit-friendly: Third-party API logs contain no personal data

const hydeLLM = new ChatOpenAI({
  modelName: "gpt-4o-mini", // Fast and cheap for HyDE generation
  temperature: 0.2,        // Low temp for consistent outputs
  maxTokens: 300,          // Hypotheticals should be concise
});

/**
 * Strip obvious PII patterns from text before processing
 * This is a defense-in-depth measure
 */
function stripPII(text: string): string {
  return text
    // Names (Mr./Mrs./Dr. followed by capitalized word)
    .replace(/\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+/g, "[NAME]")
    // SSN patterns
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[SSN]")
    // Phone numbers
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
    // Email addresses
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, "[EMAIL]")
    // Dates of birth patterns
    .replace(/\b(born|DOB|birth\s*date)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi, "[DOB]")
    // VA file numbers
    .replace(/\b(VA\s*file|claim)\s*#?\s*\d+/gi, "[VA_FILE]")
    // Addresses (basic pattern)
    .replace(/\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln)\b/gi, "[ADDRESS]");
}

/**
 * Generate a hypothetical document that would answer the query
 * This is what gets embedded - not the raw user query
 */
export async function generateHypotheticalDocument(
  query: string,
  options: {
    documentType?: "cfr" | "guidance" | "general";
    stripPersonalInfo?: boolean;
  } = {}
): Promise<string> {
  const { documentType = "cfr", stripPersonalInfo = true } = options;
  
  // Strip PII from the query before even sending to LLM
  const sanitizedQuery = stripPersonalInfo ? stripPII(query) : query;
  
  const prompts: Record<string, string> = {
    cfr: `You are generating a hypothetical VA regulation excerpt that would answer a veteran's question.
Given the question, write what a relevant section of 38 CFR might say. 
DO NOT include any personal information, names, or specific details about any individual.
Write in the style of regulatory text focusing on criteria, requirements, and procedures.

Question: ${sanitizedQuery}

Hypothetical CFR excerpt:`,

    guidance: `You are generating a hypothetical VA guidance document excerpt.
Given the question, write what official VA guidance might say on this topic.
DO NOT include any personal information, names, or specific details about any individual.
Focus on general procedures, eligibility criteria, and requirements.

Question: ${sanitizedQuery}

Hypothetical guidance:`,

    general: `You are generating a hypothetical document that would answer this VA benefits question.
DO NOT include any personal information, names, or specific details about any individual.
Focus on general criteria, ratings, and procedures.

Question: ${sanitizedQuery}

Hypothetical answer:`,
  };

  try {
    const response = await hydeLLM.invoke(prompts[documentType]);
    const hypothetical = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
    
    // Double-check: strip any PII that might have been generated
    return stripPersonalInfo ? stripPII(hypothetical) : hypothetical;
  } catch (error) {
    console.error("Error generating hypothetical document:", error);
    // Fallback: return sanitized query itself
    return sanitizedQuery;
  }
}

/**
 * Get embeddings using HyDE - generates hypothetical first, then embeds
 * This is the privacy-preserving alternative to direct query embedding
 */
export async function getHyDEEmbeddings(
  query: string,
  options: {
    documentType?: "cfr" | "guidance" | "general";
  } = {}
): Promise<number[]> {
  const hypothetical = await generateHypotheticalDocument(query, options);
  return getEmbeddings(hypothetical);
}

// Reusable Pinecone client
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

export async function getMatchesFromEmbeddings(
  embeddings: number[],
  fileKey: string
) {
  try {
    const client = getPineconeClient();
    const pineconeIndex = client.index(PINECONE_INDEX);
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));
    const queryResult = await namespace.query({
      topK: 5,
      vector: embeddings,
      includeMetadata: true,
    });
    return queryResult.matches || [];
  } catch (error) {
    console.log("error querying embeddings", error);
    throw error;
  }
}

export async function getContext(query: string, fileKey: string) {
  const queryEmbeddings = await getEmbeddings(query);
  const matches = await getMatchesFromEmbeddings(queryEmbeddings, fileKey);

  const qualifyingDocs = matches.filter(
    (match) => match.score && match.score > 0.7
  );

  type Metadata = {
    text: string;
    pageNumber: number;
  };

  let docs = qualifyingDocs.map((match) => (match.metadata as Metadata).text);
  // 5 vectors
  return docs.join("\n").substring(0, 3000);
}

// ============================================
// VA Knowledge Base Context Functions
// ============================================

export interface VAKnowledgeMetadata {
  text: string;
  source: string;
  type: string;
  identifier?: string;
  title?: string;
  section?: string;
  hierarchy?: string;
}

export interface VAKnowledgeMatch {
  id: string;
  score: number;
  metadata: VAKnowledgeMetadata;
}

/**
 * Query the VA knowledge base (Title 38 CFR, VA API docs)
 * @param query - The search query
 * @param topK - Number of results to return (default 10)
 * @param minScore - Minimum similarity score (default 0.6)
 * @param filter - Optional metadata filter (e.g., { source: "title-38-cfr" })
 */
export async function getVAKnowledgeContext(
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    filter?: Record<string, string>;
  } = {}
): Promise<VAKnowledgeMatch[]> {
  const { topK = 10, minScore = 0.6, filter } = options;
  
  try {
    const queryEmbeddings = await getEmbeddings(query);
    const client = getPineconeClient();
    const pineconeIndex = client.index(PINECONE_INDEX);
    const namespace = pineconeIndex.namespace(VA_KNOWLEDGE_NAMESPACE);
    
    const queryResult = await namespace.query({
      topK,
      vector: queryEmbeddings,
      includeMetadata: true,
      filter,
    });
    
    const matches = (queryResult.matches || [])
      .filter((match) => match.score && match.score >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score!,
        metadata: match.metadata as VAKnowledgeMetadata,
      }));
    
    return matches;
  } catch (error) {
    console.error("Error querying VA knowledge base:", error);
    return [];
  }
}

/**
 * Get formatted VA knowledge context for LLM prompts
 * @param query - The search query
 * @param maxChars - Maximum characters in the context (default 4000)
 */
export async function getFormattedVAContext(
  query: string,
  maxChars: number = 4000
): Promise<string> {
  const matches = await getVAKnowledgeContext(query, { topK: 8 });
  
  if (matches.length === 0) {
    return "";
  }
  
  let context = "=== Relevant VA Regulations and Information ===\n\n";
  let currentLength = context.length;
  
  for (const match of matches) {
    const entry = `[Source: ${match.metadata.source}${match.metadata.identifier ? ` | ${match.metadata.identifier}` : ""}]\n${match.metadata.text}\n\n---\n\n`;
    
    if (currentLength + entry.length > maxChars) {
      break;
    }
    
    context += entry;
    currentLength += entry.length;
  }
  
  return context;
}

/**
 * Search specifically in Title 38 CFR
 */
export async function searchCFR(
  query: string,
  topK: number = 5
): Promise<VAKnowledgeMatch[]> {
  return getVAKnowledgeContext(query, {
    topK,
    filter: { source: "title-38-cfr" },
  });
}

/**
 * Search VA API documentation
 */
export async function searchVAAPIDocs(
  query: string,
  topK: number = 5
): Promise<VAKnowledgeMatch[]> {
  return getVAKnowledgeContext(query, {
    topK,
    minScore: 0.5, // Lower threshold for API docs
  });
}

// ============================================
// Enhanced VA Knowledge Base (v3) - Better accuracy
// ============================================

export interface VAKnowledgeMetadataV3 {
  text: string;
  source: string;
  source_type: "cfr" | "api-doc";
  cfr_identifier: string;
  hierarchy: string;
  hierarchy_depth: number;
  part: string;
  document_type: string;
  chunk_type: "parent" | "child";
  parent_id?: string;
  child_ids?: string[];
  references_cfr?: string[];
  references_usc?: string[];
  references_forms?: string[];
  referenced_by?: string[];
  unique_terms?: string[];
  diagnostic_codes?: string[];
  conditions?: string[];
  rating_percentages?: number[];
}

export interface VAKnowledgeMatchV3 {
  id: string;
  score: number;
  metadata: VAKnowledgeMetadataV3;
}

export interface EnhancedSearchOptions {
  topK?: number;
  minScore?: number;
  // Metadata filters for precise retrieval
  part?: string;              // Filter by CFR part (e.g., "3", "4")
  documentType?: string;      // "section", "part", "subpart"
  condition?: string;         // Filter by medical condition
  diagnosticCode?: string;    // Filter by diagnostic code
  // Advanced options
  includeParent?: boolean;    // If child match, also fetch parent for context
  expandReferences?: boolean; // Include sections referenced by matches
  chunkType?: "parent" | "child" | "both";
  // Privacy options
  useHyDE?: boolean;          // Use Hypothetical Document Embeddings (privacy-preserving)
  hydeDocType?: "cfr" | "guidance" | "general";  // Type of hypothetical to generate
}

/**
 * Enhanced VA knowledge search with metadata filtering
 * Uses v3 index with boilerplate removal, cross-references, and parent-child chunks
 * 
 * Privacy mode (useHyDE: true):
 * - Generates a hypothetical answer first (no PII)
 * - Embeds the hypothetical instead of raw query
 * - Third-party APIs never see personal details
 */
export async function searchVAKnowledgeV3(
  query: string,
  options: EnhancedSearchOptions = {}
): Promise<VAKnowledgeMatchV3[]> {
  const {
    topK = 10,
    minScore = 0.55, // Slightly lower threshold since boilerplate removed
    part,
    documentType,
    condition,
    diagnosticCode,
    includeParent = true,
    expandReferences = false,
    chunkType = "both",
    useHyDE = false,
    hydeDocType = "cfr",
  } = options;

  try {
    // Use HyDE for privacy-preserving search, or direct embedding
    const queryEmbeddings = useHyDE 
      ? await getHyDEEmbeddings(query, { documentType: hydeDocType })
      : await getEmbeddings(stripPII(query)); // Still strip PII from direct queries
    const client = getPineconeClient();
    const pineconeIndex = client.index(PINECONE_INDEX);
    const namespace = pineconeIndex.namespace(VA_KNOWLEDGE_NAMESPACE_V3);

    // Build filter object
    const filter: Record<string, any> = {};
    
    if (part) {
      filter.part = part;
    }
    if (documentType) {
      filter.document_type = documentType;
    }
    if (condition) {
      filter.conditions = { $in: [condition.toLowerCase()] };
    }
    if (diagnosticCode) {
      filter.diagnostic_codes = { $in: [diagnosticCode] };
    }
    if (chunkType !== "both") {
      filter.chunk_type = chunkType;
    }

    const queryResult = await namespace.query({
      topK: topK * 2, // Fetch more to account for filtering
      vector: queryEmbeddings,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    let matches = (queryResult.matches || [])
      .filter((match) => match.score && match.score >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score!,
        metadata: match.metadata as VAKnowledgeMetadataV3,
      }));

    // If we got child chunks, fetch their parents for additional context
    if (includeParent) {
      const parentIdsToFetch = new Set<string>();
      for (const match of matches) {
        if (match.metadata.chunk_type === "child" && match.metadata.parent_id) {
          parentIdsToFetch.add(match.metadata.parent_id);
        }
      }

      if (parentIdsToFetch.size > 0) {
        const parentIds = Array.from(parentIdsToFetch);
        const parentResults = await namespace.fetch(parentIds);
        
        for (const [id, record] of Object.entries(parentResults.records || {})) {
          if (record && !matches.some(m => m.id === id)) {
            matches.push({
              id,
              score: 0.9, // High score since it's the parent of a match
              metadata: record.metadata as VAKnowledgeMetadataV3,
            });
          }
        }
      }
    }

    // Optionally expand to include referenced sections
    if (expandReferences && matches.length > 0) {
      const referencedSections = new Set<string>();
      for (const match of matches) {
        if (match.metadata.references_cfr) {
          for (const ref of match.metadata.references_cfr) {
            referencedSections.add(ref);
          }
        }
      }

      // Search for referenced sections (limited to avoid explosion)
      if (referencedSections.size > 0) {
        const refArray = Array.from(referencedSections).slice(0, 5);
        for (const ref of refArray) {
          try {
            const refResult = await namespace.query({
              topK: 1,
              vector: queryEmbeddings, // Use same embedding
              filter: { cfr_identifier: ref, chunk_type: "parent" },
              includeMetadata: true,
            });
            
            if (refResult.matches?.[0]) {
              const refMatch = refResult.matches[0];
              if (!matches.some(m => m.id === refMatch.id)) {
                matches.push({
                  id: refMatch.id,
                  score: (refMatch.score || 0.5) * 0.8, // Discount for being a reference
                  metadata: refMatch.metadata as VAKnowledgeMetadataV3,
                });
              }
            }
          } catch (e) {
            // Ignore errors for reference expansion
          }
        }
      }
    }

    // Sort by score and limit
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);

  } catch (error) {
    console.error("Error querying VA knowledge base v3:", error);
    // Fallback to v1 namespace
    const fallbackMatches = await getVAKnowledgeContext(query, { topK });
    return fallbackMatches as unknown as VAKnowledgeMatchV3[];
  }
}

/**
 * Get formatted context with hierarchy and cross-reference information
 */
export async function getFormattedVAContextV3(
  query: string,
  maxChars: number = 4000,
  options: EnhancedSearchOptions = {}
): Promise<string> {
  const matches = await searchVAKnowledgeV3(query, { ...options, topK: 12 });

  if (matches.length === 0) {
    return "";
  }

  let context = "=== VA Regulations & Knowledge Base ===\n\n";
  let currentLength = context.length;

  // Group matches by CFR identifier to avoid duplicates
  const seen = new Set<string>();

  for (const match of matches) {
    // Skip if we've already included this section
    const sectionKey = match.metadata.cfr_identifier;
    if (seen.has(sectionKey)) continue;
    seen.add(sectionKey);

    // Build rich context entry
    const parts: string[] = [];
    
    // Header with source info
    parts.push(`[${match.metadata.cfr_identifier}]`);
    parts.push(`Location: ${match.metadata.hierarchy}`);
    
    // Cross-references (important for understanding context)
    if (match.metadata.references_cfr?.length) {
      parts.push(`References: ${match.metadata.references_cfr.slice(0, 3).join(", ")}`);
    }
    if (match.metadata.referenced_by?.length) {
      parts.push(`Referenced by: ${match.metadata.referenced_by.slice(0, 3).join(", ")}`);
    }
    
    // Key entities
    if (match.metadata.conditions?.length) {
      parts.push(`Conditions: ${match.metadata.conditions.join(", ")}`);
    }
    if (match.metadata.diagnostic_codes?.length) {
      parts.push(`Diagnostic Codes: ${match.metadata.diagnostic_codes.join(", ")}`);
    }
    if (match.metadata.rating_percentages?.length) {
      parts.push(`Rating %: ${match.metadata.rating_percentages.join(", ")}`);
    }
    
    parts.push(""); // Blank line
    parts.push(match.metadata.text);
    parts.push("\n---\n");

    const entry = parts.join("\n");

    if (currentLength + entry.length > maxChars) {
      break;
    }

    context += entry;
    currentLength += entry.length;
  }

  return context;
}

/**
 * Search by specific condition (e.g., "PTSD", "tinnitus")
 */
export async function searchByCondition(
  condition: string,
  query?: string
): Promise<VAKnowledgeMatchV3[]> {
  // If no query provided, use the condition itself
  const searchQuery = query || `VA disability rating criteria for ${condition}`;
  
  return searchVAKnowledgeV3(searchQuery, {
    condition: condition.toLowerCase(),
    topK: 8,
    includeParent: true,
  });
}

/**
 * Search by diagnostic code
 */
export async function searchByDiagnosticCode(
  code: string,
  query?: string
): Promise<VAKnowledgeMatchV3[]> {
  const searchQuery = query || `VA rating schedule diagnostic code ${code}`;
  
  return searchVAKnowledgeV3(searchQuery, {
    diagnosticCode: code,
    topK: 5,
    includeParent: true,
  });
}

/**
 * Search within a specific CFR part
 */
export async function searchCFRPart(
  part: string,
  query: string
): Promise<VAKnowledgeMatchV3[]> {
  return searchVAKnowledgeV3(query, {
    part,
    topK: 10,
    chunkType: "both",
  });
}

/**
 * Privacy-preserving search - always uses HyDE
 * Use this when handling user queries that may contain personal information
 * 
 * What happens:
 * 1. PII is stripped from the query
 * 2. LLM generates a generic hypothetical answer
 * 3. The hypothetical (no PII) is embedded
 * 4. Vector search finds relevant regulations
 * 
 * Result: OpenAI embedding API and Pinecone logs contain no personal data
 */
export async function searchVAKnowledgePrivate(
  query: string,
  options: Omit<EnhancedSearchOptions, "useHyDE"> = {}
): Promise<VAKnowledgeMatchV3[]> {
  return searchVAKnowledgeV3(query, {
    ...options,
    useHyDE: true,
    hydeDocType: options.hydeDocType || "cfr",
  });
}

/**
 * Get formatted context using privacy-preserving search
 * Use this in the chat route for production
 */
export async function getFormattedVAContextPrivate(
  query: string,
  maxChars: number = 4000
): Promise<string> {
  const matches = await searchVAKnowledgePrivate(query, { topK: 12 });
  
  if (matches.length === 0) {
    return "";
  }

  let context = "=== VA Regulations & Knowledge Base ===\n\n";
  let currentLength = context.length;
  const seen = new Set<string>();

  for (const match of matches) {
    const sectionKey = match.metadata.cfr_identifier;
    if (seen.has(sectionKey)) continue;
    seen.add(sectionKey);

    const parts: string[] = [];
    parts.push(`[${match.metadata.cfr_identifier}]`);
    parts.push(`Location: ${match.metadata.hierarchy}`);
    
    if (match.metadata.references_cfr?.length) {
      parts.push(`References: ${match.metadata.references_cfr.slice(0, 3).join(", ")}`);
    }
    if (match.metadata.conditions?.length) {
      parts.push(`Conditions: ${match.metadata.conditions.join(", ")}`);
    }
    if (match.metadata.diagnostic_codes?.length) {
      parts.push(`Diagnostic Codes: ${match.metadata.diagnostic_codes.join(", ")}`);
    }
    
    parts.push("");
    parts.push(match.metadata.text);
    parts.push("\n---\n");

    const entry = parts.join("\n");
    if (currentLength + entry.length > maxChars) break;
    
    context += entry;
    currentLength += entry.length;
  }

  return context;
}

/**
 * Get sections that reference a given section
 * Useful for understanding how regulations connect
 */
export async function getRelatedSections(
  cfrIdentifier: string
): Promise<VAKnowledgeMatchV3[]> {
  const client = getPineconeClient();
  const pineconeIndex = client.index(PINECONE_INDEX);
  const namespace = pineconeIndex.namespace(VA_KNOWLEDGE_NAMESPACE_V3);

  try {
    // First, find the section itself
    const sectionResult = await namespace.query({
      topK: 1,
      vector: await getEmbeddings(cfrIdentifier),
      filter: { cfr_identifier: cfrIdentifier, chunk_type: "parent" },
      includeMetadata: true,
    });

    if (!sectionResult.matches?.[0]) {
      return [];
    }

    const section = sectionResult.matches[0].metadata as VAKnowledgeMetadataV3;
    const relatedIds: string[] = [];

    // Gather IDs from references and referenced_by
    if (section.references_cfr) {
      relatedIds.push(...section.references_cfr);
    }
    if (section.referenced_by) {
      relatedIds.push(...section.referenced_by);
    }

    // Fetch related sections
    const results: VAKnowledgeMatchV3[] = [];
    for (const refId of relatedIds.slice(0, 10)) {
      const refResult = await namespace.query({
        topK: 1,
        vector: await getEmbeddings(refId),
        filter: { cfr_identifier: { $in: [refId] }, chunk_type: "parent" },
        includeMetadata: true,
      });
      
      if (refResult.matches?.[0]) {
        results.push({
          id: refResult.matches[0].id,
          score: refResult.matches[0].score || 0.5,
          metadata: refResult.matches[0].metadata as VAKnowledgeMetadataV3,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error getting related sections:", error);
    return [];
  }
}