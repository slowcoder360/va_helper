/**
 * Advanced VA Knowledge Base Indexer (v3)
 * 
 * Addresses government text challenges:
 * - Removes legal boilerplate before embedding (reduces vector normalization)
 * - Extracts and preserves cross-references as structured metadata
 * - Contextual embedding (hierarchy baked into text)
 * - Parent-child chunking (small for precision, large for context)
 * - Discriminative keyword extraction (what makes THIS section unique)
 * 
 * Run with: npx tsx scripts/index-va-knowledge-v3.ts
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
  namespace: "va-knowledge-v3",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  
  // Parent-child chunking
  parentChunkSize: 2000,    // Larger context chunks
  childChunkSize: 500,      // Precise retrieval chunks
  chunkOverlap: 100,
  
  batchSize: 50,
  rateLimitDelay: 300,
};

// ============================================
// Government Text Boilerplate Removal
// ============================================

// Common legal/regulatory phrases that add noise but not meaning
const BOILERPLATE_PATTERNS = [
  /\bpursuant to\b/gi,
  /\bin accordance with\b/gi,
  /\bnotwithstanding the provisions of\b/gi,
  /\bsubject to the provisions of\b/gi,
  /\bas provided in\b/gi,
  /\bfor purposes of this\b/gi,
  /\bwithin the meaning of\b/gi,
  /\bunder this section\b/gi,
  /\bunder this part\b/gi,
  /\bthe secretary (shall|may|will)\b/gi,
  /\bthe department (shall|may|will)\b/gi,
  /\bexcept as (otherwise )?provided\b/gi,
  /\bunless otherwise (specified|provided|stated)\b/gi,
  /\bnothing in this (section|part|subpart)\b/gi,
  /\bfor the purpose of\b/gi,
  /\bwith respect to\b/gi,
  /\bin the case of\b/gi,
  /\bin any case\b/gi,
  /\bas the case may be\b/gi,
  /\bto the extent (that |practicable )?\b/gi,
  /\bas appropriate\b/gi,
  /\bas applicable\b/gi,
  /\bas necessary\b/gi,
  /\bas determined by\b/gi,
  /\bherein\b/gi,
  /\bthereof\b/gi,
  /\btherein\b/gi,
  /\bwhereof\b/gi,
  /\baforesaid\b/gi,
];

function removeBoilerplate(text: string): string {
  let cleaned = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  // Collapse multiple spaces
  return cleaned.replace(/\s+/g, " ").trim();
}

// ============================================
// Cross-Reference Extraction
// ============================================

interface CrossReference {
  type: "cfr" | "usc" | "form" | "internal";
  raw: string;
  normalized: string;
  title?: string;
  part?: string;
  section?: string;
}

// Patterns for extracting references
const REFERENCE_PATTERNS = {
  // 38 CFR 3.4, § 3.4, §3.4(a)(1)
  cfr: /(?:38\s*C\.?F\.?R\.?\s*)?[§§]?\s*(\d+)\.(\d+)(?:\([a-z0-9]+\))*(?:\([a-z0-9]+\))*/gi,
  // 38 U.S.C. 1110
  usc: /38\s*U\.?S\.?C\.?\s*[§§]?\s*(\d+)/gi,
  // VA Form 21-526EZ
  form: /(?:VA\s*)?Form\s*(\d{2}-\d+[A-Z]*)/gi,
  // "part 3", "subpart A", "this section"
  internal: /(?:part|subpart|section|paragraph)\s+([A-Z0-9]+(?:\.[0-9]+)?)/gi,
};

function extractCrossReferences(text: string, currentPart?: string): CrossReference[] {
  const refs: CrossReference[] = [];
  const seen = new Set<string>();
  
  // CFR references
  let match;
  const cfrPattern = new RegExp(REFERENCE_PATTERNS.cfr.source, "gi");
  while ((match = cfrPattern.exec(text)) !== null) {
    const normalized = `38 CFR ${match[1]}.${match[2]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      refs.push({
        type: "cfr",
        raw: match[0],
        normalized,
        title: "38",
        part: match[1],
        section: `${match[1]}.${match[2]}`,
      });
    }
  }
  
  // USC references
  const uscPattern = new RegExp(REFERENCE_PATTERNS.usc.source, "gi");
  while ((match = uscPattern.exec(text)) !== null) {
    const normalized = `38 USC ${match[1]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      refs.push({
        type: "usc",
        raw: match[0],
        normalized,
        section: match[1],
      });
    }
  }
  
  // Form references
  const formPattern = new RegExp(REFERENCE_PATTERNS.form.source, "gi");
  while ((match = formPattern.exec(text)) !== null) {
    const normalized = `VA Form ${match[1]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      refs.push({
        type: "form",
        raw: match[0],
        normalized,
      });
    }
  }
  
  return refs;
}

// ============================================
// Discriminative Keyword Extraction
// ============================================

// Global term frequency tracking (built during processing)
const globalTermFrequency: Map<string, number> = new Map();
const documentTerms: Map<string, Set<string>> = new Map();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

// Extended stopwords including legal terms that appear everywhere
const STOPWORDS = new Set([
  // Standard
  "the", "and", "for", "that", "this", "with", "are", "not", "but", "was",
  "have", "has", "had", "been", "will", "shall", "may", "can", "could",
  "would", "should", "must", "any", "all", "each", "every", "such", "other",
  "than", "from", "into", "upon", "under", "over", "after", "before",
  "between", "through", "during", "including", "without", "within",
  // Legal/regulatory specific
  "section", "subsection", "paragraph", "part", "subpart", "chapter",
  "title", "provision", "provisions", "regulation", "regulations",
  "requirement", "requirements", "determination", "determinations",
  "application", "applicable", "appropriate", "required", "provided",
  "established", "described", "specified", "defined", "considered",
  "purposes", "means", "case", "cases", "individual", "person", "persons",
]);

function extractDiscriminativeTerms(
  text: string,
  docId: string,
  allTexts: Map<string, string>
): string[] {
  const tokens = tokenize(text);
  const termFreq = new Map<string, number>();
  
  // Count terms in this document
  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  }
  
  // Calculate TF-IDF-like score
  const scores: Array<[string, number]> = [];
  const totalDocs = allTexts.size || 1;
  
  for (const [term, tf] of termFreq.entries()) {
    // Document frequency (how many docs contain this term)
    let df = 0;
    for (const [_, docText] of allTexts) {
      if (docText.toLowerCase().includes(term)) {
        df++;
      }
    }
    
    // IDF with smoothing
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
    const tfidf = tf * idf;
    
    scores.push([term, tfidf]);
  }
  
  // Return top discriminative terms
  return scores
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);
}

// ============================================
// Contextual Text Building
// ============================================

function buildContextualText(
  content: string,
  hierarchy: string[],
  identifier: string,
  documentType: string
): string {
  // Prefix with strong contextual signal
  const contextPrefix = [
    `[DOCUMENT: 38 CFR ${identifier}]`,
    `[TYPE: ${documentType}]`,
    `[LOCATION: ${hierarchy.join(" > ")}]`,
    "",
  ].join("\n");
  
  return contextPrefix + content;
}

// ============================================
// Parent-Child Chunking
// ============================================

interface ChunkPair {
  parent: {
    id: string;
    text: string;
    textForEmbedding: string; // Boilerplate removed
  };
  children: Array<{
    id: string;
    text: string;
    textForEmbedding: string;
    startOffset: number;
    endOffset: number;
  }>;
}

function createParentChildChunks(
  fullText: string,
  baseId: string
): ChunkPair {
  // Parent is the full text (up to limit)
  const parentText = fullText.slice(0, CONFIG.parentChunkSize);
  
  // Children are smaller precise chunks
  const children: ChunkPair["children"] = [];
  let offset = 0;
  let childIndex = 0;
  
  while (offset < fullText.length) {
    const end = Math.min(offset + CONFIG.childChunkSize, fullText.length);
    
    // Find sentence boundary
    let actualEnd = end;
    if (end < fullText.length) {
      const sentenceEnd = fullText.lastIndexOf(". ", end);
      if (sentenceEnd > offset + CONFIG.childChunkSize * 0.5) {
        actualEnd = sentenceEnd + 1;
      }
    }
    
    const childText = fullText.slice(offset, actualEnd).trim();
    if (childText.length > 50) { // Skip tiny fragments
      children.push({
        id: `${baseId}-child-${childIndex}`,
        text: childText,
        textForEmbedding: removeBoilerplate(childText),
        startOffset: offset,
        endOffset: actualEnd,
      });
      childIndex++;
    }
    
    offset = actualEnd - CONFIG.chunkOverlap;
    if (offset <= children[children.length - 1]?.startOffset) {
      offset = actualEnd; // Prevent infinite loop
    }
  }
  
  return {
    parent: {
      id: `${baseId}-parent`,
      text: parentText,
      textForEmbedding: removeBoilerplate(parentText),
    },
    children,
  };
}

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
}

interface EnhancedChunk {
  id: string;
  text: string;                    // Original text
  textForEmbedding: string;        // Cleaned for embedding
  metadata: {
    // Source
    source: string;
    source_type: "cfr" | "api-doc";
    
    // Location (critical for disambiguation)
    cfr_identifier: string;
    hierarchy: string;
    hierarchy_depth: number;
    part: string;
    document_type: string;
    
    // Parent-child relationship
    chunk_type: "parent" | "child";
    parent_id?: string;
    child_ids?: string[];
    
    // Cross-references (the semantic links)
    references_cfr?: string[];     // Other CFR sections referenced
    references_usc?: string[];     // USC sections referenced
    references_forms?: string[];   // Forms referenced
    referenced_by?: string[];      // Sections that reference this one
    
    // Discriminative content
    unique_terms?: string[];       // Terms that distinguish this section
    
    // Entities
    diagnostic_codes?: string[];
    conditions?: string[];
    rating_percentages?: number[];
    
    // For retrieval
    text: string;                  // Stored for return
  };
}

// ============================================
// OpenAI Client
// ============================================

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: CONFIG.embeddingModel,
    input: texts,
    dimensions: CONFIG.embeddingDimensions,
  });
  return response.data.map(d => d.embedding);
}

// ============================================
// Entity Extraction (from v2)
// ============================================

const DIAGNOSTIC_CODE_PATTERN = /\b(\d{4})\b/g;
const RATING_PATTERN = /\b(\d{1,3})\s*(?:percent|%)/gi;

const VA_CONDITIONS = [
  "ptsd", "post-traumatic stress", "tbi", "traumatic brain injury",
  "hearing loss", "tinnitus", "back pain", "lumbar", "cervical",
  "knee", "ankle", "shoulder", "hip", "diabetes", "hypertension",
  "sleep apnea", "migraine", "depression", "anxiety", "gerd",
  "radiculopathy", "neuropathy", "arthritis", "carpal tunnel",
  "sciatica", "vertigo", "sinusitis", "rhinitis", "asthma",
  "ischemic heart", "cardiovascular", "erectile dysfunction",
  "gulf war", "burn pit", "agent orange", "presumptive",
];

function extractEntities(text: string): {
  diagnosticCodes: string[];
  conditions: string[];
  ratingPercentages: number[];
} {
  const normalizedText = text.toLowerCase();
  
  const diagnosticCodes: string[] = [];
  const codeMatches = text.match(DIAGNOSTIC_CODE_PATTERN);
  if (codeMatches) {
    codeMatches.forEach(code => {
      const num = parseInt(code);
      if (num >= 5000 && num <= 9999) {
        diagnosticCodes.push(code);
      }
    });
  }
  
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
  
  const conditions = VA_CONDITIONS.filter(c => normalizedText.includes(c));
  
  return {
    diagnosticCodes: [...new Set(diagnosticCodes)],
    conditions: [...new Set(conditions)],
    ratingPercentages: ratingPercentages.sort((a, b) => a - b),
  };
}

// ============================================
// CFR Processing
// ============================================

// First pass: collect all texts for discriminative term calculation
const allSectionTexts = new Map<string, string>();

function collectCFRTexts(node: CFRNode, hierarchy: string[] = []): void {
  if (node.reserved) return;
  
  const currentHierarchy = [...hierarchy, node.label_description || node.label];
  
  if (["section", "part", "subpart"].includes(node.type)) {
    const text = `${node.label}\n${node.label_description || ""}`;
    allSectionTexts.set(node.identifier, text);
  }
  
  if (node.children) {
    for (const child of node.children) {
      collectCFRTexts(child, currentHierarchy);
    }
  }
}

// Second pass: build reference graph
const referenceGraph = new Map<string, Set<string>>(); // section -> sections it references
const referencedBy = new Map<string, Set<string>>();   // section -> sections that reference it

function buildReferenceGraph(node: CFRNode): void {
  if (node.reserved) return;
  
  if (["section", "part", "subpart"].includes(node.type)) {
    const text = allSectionTexts.get(node.identifier) || "";
    const refs = extractCrossReferences(text);
    
    const refsSet = new Set<string>();
    for (const ref of refs) {
      if (ref.type === "cfr" && ref.section) {
        refsSet.add(ref.section);
        
        // Build reverse index
        if (!referencedBy.has(ref.section)) {
          referencedBy.set(ref.section, new Set());
        }
        referencedBy.get(ref.section)!.add(node.identifier);
      }
    }
    referenceGraph.set(node.identifier, refsSet);
  }
  
  if (node.children) {
    for (const child of node.children) {
      buildReferenceGraph(child);
    }
  }
}

// Third pass: create chunks with full context
function processCFRNode(
  node: CFRNode,
  hierarchy: string[] = [],
  partNumber?: string
): EnhancedChunk[] {
  const chunks: EnhancedChunk[] = [];
  
  if (node.reserved) return chunks;
  
  const currentHierarchy = [...hierarchy, node.label_description || node.label];
  let currentPart = partNumber;
  if (node.type === "part") {
    currentPart = node.identifier.split(".")[0];
  }
  
  if (["section", "part", "subpart"].includes(node.type)) {
    // Build contextual text
    const rawText = `${node.label}\n\n${node.label_description || ""}`;
    const contextualText = buildContextualText(
      rawText,
      currentHierarchy,
      node.identifier,
      node.type
    );
    
    // Get cross-references
    const refs = extractCrossReferences(rawText);
    const cfrRefs = refs.filter(r => r.type === "cfr").map(r => r.normalized);
    const uscRefs = refs.filter(r => r.type === "usc").map(r => r.normalized);
    const formRefs = refs.filter(r => r.type === "form").map(r => r.normalized);
    
    // Get sections that reference this one
    const incomingRefs = referencedBy.get(node.identifier);
    
    // Get discriminative terms
    const uniqueTerms = extractDiscriminativeTerms(
      rawText,
      node.identifier,
      allSectionTexts
    );
    
    // Extract entities
    const entities = extractEntities(rawText);
    
    // Create parent-child chunks
    const chunkPair = createParentChildChunks(
      contextualText,
      `cfr-38-${node.identifier.replace(/[^a-zA-Z0-9]/g, "-")}`
    );
    
    // Parent chunk
    chunks.push({
      id: chunkPair.parent.id,
      text: chunkPair.parent.text,
      textForEmbedding: chunkPair.parent.textForEmbedding,
      metadata: {
        source: "title-38-cfr",
        source_type: "cfr",
        cfr_identifier: `38 CFR ${node.identifier}`,
        hierarchy: currentHierarchy.join(" > "),
        hierarchy_depth: currentHierarchy.length,
        part: currentPart || "",
        document_type: node.type,
        chunk_type: "parent",
        child_ids: chunkPair.children.map(c => c.id),
        references_cfr: cfrRefs.length > 0 ? cfrRefs : undefined,
        references_usc: uscRefs.length > 0 ? uscRefs : undefined,
        references_forms: formRefs.length > 0 ? formRefs : undefined,
        referenced_by: incomingRefs ? Array.from(incomingRefs).map(r => `38 CFR ${r}`) : undefined,
        unique_terms: uniqueTerms.length > 0 ? uniqueTerms : undefined,
        diagnostic_codes: entities.diagnosticCodes.length > 0 ? entities.diagnosticCodes : undefined,
        conditions: entities.conditions.length > 0 ? entities.conditions : undefined,
        rating_percentages: entities.ratingPercentages.length > 0 ? entities.ratingPercentages : undefined,
        text: chunkPair.parent.text,
      },
    });
    
    // Child chunks
    for (const child of chunkPair.children) {
      chunks.push({
        id: child.id,
        text: child.text,
        textForEmbedding: child.textForEmbedding,
        metadata: {
          source: "title-38-cfr",
          source_type: "cfr",
          cfr_identifier: `38 CFR ${node.identifier}`,
          hierarchy: currentHierarchy.join(" > "),
          hierarchy_depth: currentHierarchy.length,
          part: currentPart || "",
          document_type: node.type,
          chunk_type: "child",
          parent_id: chunkPair.parent.id,
          // Inherit references from parent
          references_cfr: cfrRefs.length > 0 ? cfrRefs : undefined,
          unique_terms: uniqueTerms.length > 0 ? uniqueTerms : undefined,
          diagnostic_codes: entities.diagnosticCodes.length > 0 ? entities.diagnosticCodes : undefined,
          conditions: entities.conditions.length > 0 ? entities.conditions : undefined,
          text: child.text,
        },
      });
    }
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
// API Doc Processing
// ============================================

function processAPIDoc(filePath: string, apiName: string): EnhancedChunk[] {
  const chunks: EnhancedChunk[] = [];
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const doc = JSON.parse(content);
    
    if (doc.info?.description) {
      const text = `[API: ${doc.info.title || apiName}]\n\n${doc.info.description}`;
      const cleaned = removeBoilerplate(text);
      
      chunks.push({
        id: `api-${apiName}-overview`,
        text: text,
        textForEmbedding: cleaned,
        metadata: {
          source: apiName,
          source_type: "api-doc",
          cfr_identifier: apiName,
          hierarchy: apiName,
          hierarchy_depth: 1,
          part: "",
          document_type: "api-overview",
          chunk_type: "parent",
          text: text,
        },
      });
    }
    
    if (doc.paths) {
      for (const [pathKey, pathValue] of Object.entries(doc.paths)) {
        const pathObj = pathValue as Record<string, any>;
        
        for (const [method, details] of Object.entries(pathObj)) {
          if (typeof details !== "object" || !details.description) continue;
          
          const text = [
            `[API: ${apiName}]`,
            `[ENDPOINT: ${method.toUpperCase()} ${pathKey}]`,
            "",
            details.summary || "",
            "",
            details.description,
          ].join("\n");
          
          chunks.push({
            id: `api-${apiName}-${method}-${pathKey.replace(/[^a-zA-Z0-9]/g, "-")}`,
            text: text,
            textForEmbedding: removeBoilerplate(text),
            metadata: {
              source: apiName,
              source_type: "api-doc",
              cfr_identifier: `${apiName}:${method.toUpperCase()} ${pathKey}`,
              hierarchy: `${apiName} > ${pathKey}`,
              hierarchy_depth: 2,
              part: "",
              document_type: "api-endpoint",
              chunk_type: "child",
              text: text,
            },
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
// Indexing
// ============================================

async function indexChunks(
  client: Pinecone,
  chunks: EnhancedChunk[]
): Promise<void> {
  const index = client.index(CONFIG.pineconeIndex);
  const namespace = index.namespace(CONFIG.namespace);
  
  console.log(`\nIndexing ${chunks.length} chunks...`);
  
  for (let i = 0; i < chunks.length; i += CONFIG.batchSize) {
    const batch = chunks.slice(i, i + CONFIG.batchSize);
    
    try {
      const texts = batch.map(c => c.textForEmbedding);
      const embeddings = await getEmbeddings(texts);
      
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
    }
    
    if (i + CONFIG.batchSize < chunks.length) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("=== Advanced VA Knowledge Base Indexer v3 ===\n");
  console.log("Improvements:");
  console.log("  - Boilerplate removal for cleaner embeddings");
  console.log("  - Cross-reference extraction and linking");
  console.log("  - Contextual prefixes for disambiguation");
  console.log("  - Parent-child chunking");
  console.log("  - Discriminative keyword extraction");
  console.log("");
  
  if (!process.env.NEXT_PUBLIC_PINECONE_API_KEY) {
    throw new Error("NEXT_PUBLIC_PINECONE_API_KEY not set");
  }
  if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    throw new Error("NEXT_PUBLIC_OPENAI_API_KEY not set");
  }
  
  const client = new Pinecone({
    apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY,
  });
  
  const vaJsonDir = path.join(process.cwd(), "VA", "descriptive_json");
  const title38Path = path.join(vaJsonDir, "title-38.json");
  
  // Phase 1: Collect all texts
  console.log("Phase 1: Collecting all section texts...");
  if (fs.existsSync(title38Path)) {
    const title38 = JSON.parse(fs.readFileSync(title38Path, "utf-8"));
    collectCFRTexts(title38);
    console.log(`  Found ${allSectionTexts.size} sections`);
  }
  
  // Phase 2: Build reference graph
  console.log("\nPhase 2: Building cross-reference graph...");
  if (fs.existsSync(title38Path)) {
    const title38 = JSON.parse(fs.readFileSync(title38Path, "utf-8"));
    buildReferenceGraph(title38);
    
    const totalRefs = Array.from(referenceGraph.values()).reduce((sum, s) => sum + s.size, 0);
    const sectionsWithIncoming = referencedBy.size;
    console.log(`  Total outgoing references: ${totalRefs}`);
    console.log(`  Sections with incoming references: ${sectionsWithIncoming}`);
  }
  
  // Phase 3: Process and chunk
  console.log("\nPhase 3: Processing and chunking...");
  const allChunks: EnhancedChunk[] = [];
  
  if (fs.existsSync(title38Path)) {
    const title38 = JSON.parse(fs.readFileSync(title38Path, "utf-8"));
    const cfrChunks = processCFRNode(title38);
    
    const parentChunks = cfrChunks.filter(c => c.metadata.chunk_type === "parent");
    const childChunks = cfrChunks.filter(c => c.metadata.chunk_type === "child");
    const withUniqueTerms = cfrChunks.filter(c => c.metadata.unique_terms?.length);
    const withReferences = cfrChunks.filter(c => c.metadata.references_cfr?.length);
    
    console.log(`  CFR chunks: ${cfrChunks.length}`);
    console.log(`    - Parent chunks: ${parentChunks.length}`);
    console.log(`    - Child chunks: ${childChunks.length}`);
    console.log(`    - With unique terms: ${withUniqueTerms.length}`);
    console.log(`    - With cross-references: ${withReferences.length}`);
    
    allChunks.push(...cfrChunks);
  }
  
  // Process API docs
  console.log("\n  Processing VA API documentation...");
  const apiFiles = fs.readdirSync(vaJsonDir).filter(
    f => f.endsWith(".json") && f !== "title-38.json"
  );
  
  for (const file of apiFiles) {
    const apiName = file.replace(/_Info_JSON\.json$/, "").replace(/_/g, "-").toLowerCase();
    const chunks = processAPIDoc(path.join(vaJsonDir, file), apiName);
    console.log(`    ${file}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }
  
  console.log(`\nTotal chunks to index: ${allChunks.length}`);
  
  // Phase 4: Index
  await indexChunks(client, allChunks);
  
  console.log("\n=== Indexing Complete ===");
  console.log(`Namespace: ${CONFIG.namespace}`);
  console.log(`Total vectors: ${allChunks.length}`);
}

main().catch(console.error);
