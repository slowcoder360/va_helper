/**
 * Script to index VA knowledge base into Pinecone
 * 
 * Run with: npx tsx scripts/index-va-knowledge.ts
 * 
 * This indexes:
 * - Title 38 CFR (Code of Federal Regulations) - VA regulations
 * - VA API documentation JSONs
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { getEmbeddings } from "../lib/embeddings";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const PINECONE_INDEX = "va-helper";
const VA_KNOWLEDGE_NAMESPACE = "va-knowledge-base";
const BATCH_SIZE = 100;
const CHUNK_SIZE = 1500; // Characters per chunk for embedding

interface CFRNode {
  identifier: string;
  label: string;
  label_level: string;
  label_description: string;
  type: string;
  children?: CFRNode[];
  reserved?: boolean;
}

interface VAKnowledgeChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    type: string;
    identifier?: string;
    title?: string;
    section?: string;
    hierarchy?: string;
  };
}

/**
 * Recursively flatten Title 38 CFR into searchable chunks
 */
function flattenCFR(
  node: CFRNode,
  hierarchy: string[] = [],
  chunks: VAKnowledgeChunk[] = []
): VAKnowledgeChunk[] {
  const currentHierarchy = [...hierarchy, node.label_description || node.label];
  
  // Skip reserved sections
  if (node.reserved) {
    return chunks;
  }

  // Create a chunk for sections (the actual regulation text references)
  if (node.type === "section" || node.type === "part" || node.type === "subpart") {
    const chunkText = `${node.label}\n\nHierarchy: ${currentHierarchy.join(" > ")}\n\nType: ${node.type}\nIdentifier: ${node.identifier}`;
    
    chunks.push({
      id: `cfr-38-${node.identifier.replace(/[^a-zA-Z0-9]/g, "-")}`,
      text: chunkText,
      metadata: {
        source: "title-38-cfr",
        type: node.type,
        identifier: node.identifier,
        title: node.label,
        section: node.label_description,
        hierarchy: currentHierarchy.join(" > "),
      },
    });
  }

  // Recursively process children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      flattenCFR(child, currentHierarchy, chunks);
    }
  }

  return chunks;
}

/**
 * Process OpenAPI/VA API documentation JSON files
 */
function processAPIDoc(
  filePath: string,
  apiName: string
): VAKnowledgeChunk[] {
  const chunks: VAKnowledgeChunk[] = [];
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const doc = JSON.parse(content);
    
    // Extract API description
    if (doc.info?.description) {
      const descChunks = chunkText(doc.info.description, CHUNK_SIZE);
      descChunks.forEach((chunk, idx) => {
        chunks.push({
          id: `api-${apiName}-desc-${idx}`,
          text: `VA API: ${doc.info.title || apiName}\n\n${chunk}`,
          metadata: {
            source: apiName,
            type: "api-description",
            title: doc.info.title || apiName,
          },
        });
      });
    }

    // Extract endpoint descriptions
    if (doc.paths) {
      for (const [pathKey, pathValue] of Object.entries(doc.paths)) {
        const pathObj = pathValue as Record<string, any>;
        for (const [method, details] of Object.entries(pathObj)) {
          if (typeof details === "object" && details.description) {
            const endpointText = `API: ${apiName}\nEndpoint: ${method.toUpperCase()} ${pathKey}\n\nSummary: ${details.summary || ""}\n\nDescription: ${details.description}`;
            
            const descChunks = chunkText(endpointText, CHUNK_SIZE);
            descChunks.forEach((chunk, idx) => {
              chunks.push({
                id: `api-${apiName}-${method}-${pathKey.replace(/[^a-zA-Z0-9]/g, "-")}-${idx}`,
                text: chunk,
                metadata: {
                  source: apiName,
                  type: "api-endpoint",
                  title: `${method.toUpperCase()} ${pathKey}`,
                  section: details.summary || "",
                },
              });
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }

  return chunks;
}

/**
 * Split text into chunks of specified size
 */
function chunkText(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }
    
    // Find a good break point (paragraph, sentence, or word boundary)
    let breakPoint = maxSize;
    const paragraphBreak = remaining.lastIndexOf("\n\n", maxSize);
    const sentenceBreak = remaining.lastIndexOf(". ", maxSize);
    const wordBreak = remaining.lastIndexOf(" ", maxSize);
    
    if (paragraphBreak > maxSize * 0.5) {
      breakPoint = paragraphBreak + 2;
    } else if (sentenceBreak > maxSize * 0.5) {
      breakPoint = sentenceBreak + 2;
    } else if (wordBreak > maxSize * 0.5) {
      breakPoint = wordBreak + 1;
    }
    
    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }
  
  return chunks;
}

/**
 * Embed and upsert chunks to Pinecone
 */
async function indexChunks(
  client: Pinecone,
  chunks: VAKnowledgeChunk[],
  progressLabel: string
): Promise<void> {
  const index = client.index(PINECONE_INDEX);
  const namespace = index.namespace(VA_KNOWLEDGE_NAMESPACE);
  
  console.log(`\nIndexing ${chunks.length} chunks for ${progressLabel}...`);
  
  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = [];
    
    for (const chunk of batch) {
      try {
        const embedding = await getEmbeddings(chunk.text);
        vectors.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            text: chunk.text.slice(0, 36000), // Pinecone metadata limit
            ...chunk.metadata,
          },
        });
      } catch (error) {
        console.error(`Error embedding chunk ${chunk.id}:`, error);
      }
    }
    
    if (vectors.length > 0) {
      await namespace.upsert(vectors);
      console.log(`  Indexed ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
    }
    
    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Main indexing function
 */
async function main() {
  console.log("=== VA Knowledge Base Indexer ===\n");
  
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
  
  const allChunks: VAKnowledgeChunk[] = [];
  const vaJsonDir = path.join(process.cwd(), "VA", "descriptive_json");
  
  // 1. Process Title 38 CFR
  console.log("Processing Title 38 CFR...");
  const title38Path = path.join(vaJsonDir, "title-38.json");
  if (fs.existsSync(title38Path)) {
    const title38 = JSON.parse(fs.readFileSync(title38Path, "utf-8"));
    const cfrChunks = flattenCFR(title38);
    console.log(`  Found ${cfrChunks.length} CFR sections`);
    allChunks.push(...cfrChunks);
  }
  
  // 2. Process VA API documentation
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
  
  // 3. Index all chunks
  await indexChunks(client, allChunks, "VA Knowledge Base");
  
  console.log("\n=== Indexing Complete ===");
  console.log(`Namespace: ${VA_KNOWLEDGE_NAMESPACE}`);
  console.log(`Total vectors indexed: ${allChunks.length}`);
}

main().catch(console.error);
