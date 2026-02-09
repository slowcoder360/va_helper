/**
 * Enhanced VA Knowledge Base Indexer (v2)
 * 
 * Improvements over v1:
 * - Uses text-embedding-3-small (better accuracy, same cost)
 * - Overlapping chunks for better context
 * - Rich metadata extraction (diagnostic codes, conditions, ratings)
 * - Text preprocessing and normalization
 * - Keyword extraction for hybrid search
 * 
 * Run with: npx tsx scripts/index-va-knowledge-v2.ts
 */

import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// ============================================
// Configuration
// ============================================

const CONFIG = {
  pineconeIndex: "va-helper",
  namespace: "va-knowledge-base-v2",
  embeddingModel: "text-embedding-3-small", // Better than ada-002, same price
  embeddingDimensions: 1536,
  chunkSize: 1000,        // Smaller chunks for more precise retrieval
  chunkOverlap: 200,      // Overlap for context continuity
  batchSize: 50,          // Smaller batches for reliability
  rateLimitDelay: 300,    // ms between batches
};

// ============================================
// Types
// ============================================

interface CFRNode {
  identifier: string;
  label: string;
  label_level: string;
  label_description: string;
  type: string;
  children?: CFRNode[];
  reserved?: boolean;
  received_on?: string;
}

interface EnhancedMetadata {
  // Source identification
  source: string;
  source_type: "cfr" | "api-doc" | "form" | "guidance";
  
  // CFR-specific
  cfr_title?: string;
  cfr_part?: string;
  cfr_section?: string;
  cfr_identifier?: string;
  hierarchy?: string;
  hierarchy_depth?: number;
  
  // Content classification
  document_type: string;
  
  // Extracted entities
  diagnostic_codes?: string[];
  conditions?: string[];
  rating_percentages?: number[];
  claim_types?: string[];
  forms_referenced?: string[];
  
  // Keywords for hybrid search
  keywords?: string[];
  
  // Temporal
  effective_date?: string;
  last_updated?: string;
  
  // Chunk info
  chunk_index?: number;
  total_chunks?: number;
  
  // Full text for retrieval
  text: string;
}

interface ProcessedChunk {
  id: string;
  text: string;
  metadata: EnhancedMetadata;
}

// ============================================
// OpenAI Client (for newer embeddings)
// ============================================

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: CONFIG.embeddingModel,
    input: texts.map(t => preprocessText(t)),
    dimensions: CONFIG.embeddingDimensions,
  });
  
  return response.data.map(d => d.embedding);
}

// ============================================
// Text Preprocessing
// ============================================

function preprocessText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, " ")
    // Remove excessive punctuation
    .replace(/([.!?])\1+/g, "$1")
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove non-printable characters
    .replace(/[^\x20-\x7E\n]/g, " ")
    // Trim
    .trim();
}

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// Entity Extraction
// ============================================

// Common VA diagnostic codes patterns
const DIAGNOSTIC_CODE_PATTERN = /\b(\d{4})\b/g;
const RATING_PATTERN = /\b(\d{1,3})\s*(?:percent|%)/gi;
const FORM_PATTERN = /\b(VA\s*Form\s*\d{2}-\d+[A-Z]*|SF-\d+|DD-\d+)\b/gi;

// Common conditions mentioned in VA regulations
const VA_CONDITIONS = [
  "ptsd", "post-traumatic stress", "tbi", "traumatic brain injury",
  "hearing loss", "tinnitus", "back pain", "lumbar", "cervical",
  "knee", "ankle", "shoulder", "hip", "diabetes", "hypertension",
  "sleep apnea", "migraine", "depression", "anxiety", "gerd",
  "radiculopathy", "neuropathy", "arthritis", "carpal tunnel",
];

const CLAIM_TYPES = [
  "new claim", "increase", "secondary", "appeal", "supplemental",
  "higher-level review", "board appeal", "compensation", "pension",
];

function extractEntities(text: string): {
  diagnosticCodes: string[];
  conditions: string[];
  ratingPercentages: number[];
  claimTypes: string[];
  formsReferenced: string[];
  keywords: string[];
} {
  const normalizedText = normalizeForSearch(text);
  
  // Extract diagnostic codes (4-digit numbers in VA context)
  const diagnosticCodes: string[] = [];
  const codeMatches = text.match(DIAGNOSTIC_CODE_PATTERN);
  if (codeMatches) {
    codeMatches.forEach(code => {
      const num = parseInt(code);
      // VA diagnostic codes are typically in specific ranges
      if (num >= 5000 && num <= 9999) {
        diagnosticCodes.push(code);
      }
    });
  }
  
  // Extract rating percentages
  const ratingPercentages: number[] = [];
  const ratingMatches = text.matchAll(RATING_PATTERN);
  for (const match of ratingMatches) {
    const rating = parseInt(match[1]);
    if (rating >= 0 && rating <= 100 && rating % 10 === 0) {
      if (!ratingPercentages.includes(rating)) {
        ratingPercentages.push(rating);
      }
    }
  }
  
  // Extract conditions
  const conditions = VA_CONDITIONS.filter(condition => 
    normalizedText.includes(condition)
  );
  
  // Extract claim types
  const claimTypes = CLAIM_TYPES.filter(type =>
    normalizedText.includes(type)
  );
  
  // Extract form references
  const formsReferenced: string[] = [];
  const formMatches = text.match(FORM_PATTERN);
  if (formMatches) {
    formMatches.forEach(form => {
      const normalized = form.replace(/\s+/g, " ").toUpperCase();
      if (!formsReferenced.includes(normalized)) {
        formsReferenced.push(normalized);
      }
    });
  }
  
  // Extract keywords (important terms)
  const keywords = extractKeywords(normalizedText);
  
  return {
    diagnosticCodes: [...new Set(diagnosticCodes)],
    conditions: [...new Set(conditions)],
    ratingPercentages: ratingPercentages.sort((a, b) => a - b),
    claimTypes,
    formsReferenced,
    keywords,
  };
}

function extractKeywords(text: string): string[] {
  // Important VA-related terms to capture
  const importantTerms = [
    "service connection", "nexus", "buddy statement", "c&p exam",
    "effective date", "combined rating", "bilateral factor",
    "individual unemployability", "tdiu", "smc", "special monthly",
    "presumptive", "agent orange", "burn pit", "gulf war",
    "combat veteran", "purple heart", "pow", "mst",
  ];
  
  return importantTerms.filter(term => text.includes(term));
}

// ============================================
// Chunking with Overlap
// ============================================

function chunkTextWithOverlap(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = "";
  let overlapBuffer = "";
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap from previous
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.ceil(overlap / 5)); // Approximate word count
      overlapBuffer = overlapWords.join(" ");
      
      currentChunk = overlapBuffer + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// ============================================
// CFR Processing (Enhanced)
// ============================================

function processCFRNode(
  node: CFRNode,
  hierarchy: string[] = [],
  partNumber?: string
): ProcessedChunk[] {
  const chunks: ProcessedChunk[] = [];
  
  if (node.reserved) return chunks;
  
  const currentHierarchy = [...hierarchy, node.label_description || node.label];
  
  // Track part number for better identification
  let currentPart = partNumber;
  if (node.type === "part") {
    currentPart = node.identifier;
  }
  
  // Process sections, parts, and subparts
  if (["section", "part", "subpart"].includes(node.type)) {
    // Build rich text content
    const textParts = [
      `38 CFR ${node.identifier}: ${node.label_description || node.label}`,
      "",
      `Location: ${currentHierarchy.join(" > ")}`,
      `Type: ${node.type.charAt(0).toUpperCase() + node.type.slice(1)}`,
    ];
    
    const fullText = textParts.join("\n");
    const textChunks = chunkTextWithOverlap(fullText, CONFIG.chunkSize, CONFIG.chunkOverlap);
    
    textChunks.forEach((chunkText, idx) => {
      const entities = extractEntities(chunkText);
      
      chunks.push({
        id: `cfr-38-${node.identifier.replace(/[^a-zA-Z0-9]/g, "-")}-${idx}`,
        text: chunkText,
        metadata: {
          source: "title-38-cfr",
          source_type: "cfr",
          cfr_title: "38",
          cfr_part: currentPart,
          cfr_section: node.identifier,
          cfr_identifier: `38 CFR ${node.identifier}`,
          hierarchy: currentHierarchy.join(" > "),
          hierarchy_depth: currentHierarchy.length,
          document_type: node.type,
          diagnostic_codes: entities.diagnosticCodes.length > 0 ? entities.diagnosticCodes : undefined,
          conditions: entities.conditions.length > 0 ? entities.conditions : undefined,
          rating_percentages: entities.ratingPercentages.length > 0 ? entities.ratingPercentages : undefined,
          claim_types: entities.claimTypes.length > 0 ? entities.claimTypes : undefined,
          forms_referenced: entities.formsReferenced.length > 0 ? entities.formsReferenced : undefined,
          keywords: entities.keywords.length > 0 ? entities.keywords : undefined,
          last_updated: node.received_on,
          chunk_index: idx,
          total_chunks: textChunks.length,
          text: chunkText,
        },
      });
    });
  }
  
  // Process children
  if (node.children) {
    for (const child of node.children) {
      chunks.push(...processCFRNode(child, currentHierarchy, currentPart));
    }
  }
  
  return chunks;
}

// ============================================
// API Doc Processing (Enhanced)
// ============================================

function processAPIDoc(filePath: string, apiName: string): ProcessedChunk[] {
  const chunks: ProcessedChunk[] = [];
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const doc = JSON.parse(content);
    
    // Process API description
    if (doc.info?.description) {
      const textChunks = chunkTextWithOverlap(
        `${doc.info.title || apiName}\n\n${doc.info.description}`,
        CONFIG.chunkSize,
        CONFIG.chunkOverlap
      );
      
      textChunks.forEach((chunkText, idx) => {
        const entities = extractEntities(chunkText);
        
        chunks.push({
          id: `api-${apiName}-desc-${idx}`,
          text: chunkText,
          metadata: {
            source: apiName,
            source_type: "api-doc",
            document_type: "api-overview",
            conditions: entities.conditions.length > 0 ? entities.conditions : undefined,
            keywords: entities.keywords.length > 0 ? entities.keywords : undefined,
            chunk_index: idx,
            total_chunks: textChunks.length,
            text: chunkText,
          },
        });
      });
    }
    
    // Process endpoints
    if (doc.paths) {
      for (const [pathKey, pathValue] of Object.entries(doc.paths)) {
        const pathObj = pathValue as Record<string, any>;
        
        for (const [method, details] of Object.entries(pathObj)) {
          if (typeof details !== "object" || !details.description) continue;
          
          const endpointText = [
            `API Endpoint: ${method.toUpperCase()} ${pathKey}`,
            details.summary ? `Summary: ${details.summary}` : "",
            `Description: ${details.description}`,
            details.parameters ? `Parameters: ${JSON.stringify(details.parameters.map((p: any) => p.name))}` : "",
          ].filter(Boolean).join("\n\n");
          
          const textChunks = chunkTextWithOverlap(endpointText, CONFIG.chunkSize, CONFIG.chunkOverlap);
          
          textChunks.forEach((chunkText, idx) => {
            chunks.push({
              id: `api-${apiName}-${method}-${pathKey.replace(/[^a-zA-Z0-9]/g, "-")}-${idx}`,
              text: chunkText,
              metadata: {
                source: apiName,
                source_type: "api-doc",
                document_type: "api-endpoint",
                chunk_index: idx,
                total_chunks: textChunks.length,
                text: chunkText,
              },
            });
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
  
  return chunks;
}

// ============================================
// Batch Embedding and Indexing
// ============================================

async function indexChunks(
  client: Pinecone,
  chunks: ProcessedChunk[]
): Promise<void> {
  const index = client.index(CONFIG.pineconeIndex);
  const namespace = index.namespace(CONFIG.namespace);
  
  console.log(`\nIndexing ${chunks.length} chunks...`);
  
  for (let i = 0; i < chunks.length; i += CONFIG.batchSize) {
    const batch = chunks.slice(i, i + CONFIG.batchSize);
    
    try {
      // Get embeddings for batch
      const texts = batch.map(c => c.text);
      const embeddings = await getEmbeddings(texts);
      
      // Prepare vectors
      const vectors = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: chunk.metadata as Record<string, any>,
      }));
      
      await namespace.upsert(vectors);
      
      const progress = Math.min(i + CONFIG.batchSize, chunks.length);
      console.log(`  Indexed ${progress}/${chunks.length} (${Math.round(progress/chunks.length*100)}%)`);
      
    } catch (error) {
      console.error(`Error indexing batch at ${i}:`, error);
      // Continue with next batch
    }
    
    // Rate limiting
    if (i + CONFIG.batchSize < chunks.length) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("=== Enhanced VA Knowledge Base Indexer v2 ===\n");
  console.log("Configuration:");
  console.log(`  Model: ${CONFIG.embeddingModel}`);
  console.log(`  Chunk size: ${CONFIG.chunkSize} chars`);
  console.log(`  Chunk overlap: ${CONFIG.chunkOverlap} chars`);
  console.log(`  Namespace: ${CONFIG.namespace}`);
  console.log("");
  
  // Validate environment
  if (!process.env.NEXT_PUBLIC_PINECONE_API_KEY) {
    throw new Error("NEXT_PUBLIC_PINECONE_API_KEY not set");
  }
  if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    throw new Error("NEXT_PUBLIC_OPENAI_API_KEY not set");
  }
  
  const client = new Pinecone({
    apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY,
  });
  
  const allChunks: ProcessedChunk[] = [];
  const vaJsonDir = path.join(process.cwd(), "VA", "descriptive_json");
  
  // Process Title 38 CFR
  console.log("Processing Title 38 CFR...");
  const title38Path = path.join(vaJsonDir, "title-38.json");
  if (fs.existsSync(title38Path)) {
    const title38 = JSON.parse(fs.readFileSync(title38Path, "utf-8"));
    const cfrChunks = processCFRNode(title38);
    console.log(`  Found ${cfrChunks.length} CFR chunks`);
    allChunks.push(...cfrChunks);
    
    // Log entity extraction stats
    const withDiagCodes = cfrChunks.filter(c => c.metadata.diagnostic_codes?.length);
    const withConditions = cfrChunks.filter(c => c.metadata.conditions?.length);
    const withRatings = cfrChunks.filter(c => c.metadata.rating_percentages?.length);
    console.log(`  - With diagnostic codes: ${withDiagCodes.length}`);
    console.log(`  - With conditions: ${withConditions.length}`);
    console.log(`  - With rating percentages: ${withRatings.length}`);
  }
  
  // Process VA API documentation
  console.log("\nProcessing VA API documentation...");
  const apiFiles = fs.readdirSync(vaJsonDir).filter(
    f => f.endsWith(".json") && f !== "title-38.json"
  );
  
  for (const file of apiFiles) {
    const apiName = file.replace(/_Info_JSON\.json$/, "").replace(/_/g, "-").toLowerCase();
    const chunks = processAPIDoc(path.join(vaJsonDir, file), apiName);
    console.log(`  ${file}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }
  
  console.log(`\nTotal chunks to index: ${allChunks.length}`);
  
  // Index all chunks
  await indexChunks(client, allChunks);
  
  console.log("\n=== Indexing Complete ===");
  console.log(`Namespace: ${CONFIG.namespace}`);
  console.log(`Total vectors indexed: ${allChunks.length}`);
}

main().catch(console.error);
