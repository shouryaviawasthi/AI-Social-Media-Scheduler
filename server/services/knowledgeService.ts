import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import Document from "../models/Document.js";
import KnowledgeChunk from "../models/KnowledgeChunk.js";

const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters
const TOP_K_RESULTS = 5; // number of relevant chunks to retrieve

// Initialize Gemini for embeddings
const getEmbeddingModel = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    return new GoogleGenAI({ apiKey });
};

/**
 * Extract text from uploaded file based on file type
 */
export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
    try {
        if (fileType === "application/pdf") {
            // Dynamic import for pdf-parse to avoid ESM issues
            const pdfParseModule = await import("pdf-parse");
            const parse = (pdfParseModule as any).default || pdfParseModule;
            const data = await parse(buffer);
            return data.text;
        } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (fileType === "text/plain") {
            return buffer.toString("utf-8");
        }
        throw new Error(`Unsupported file type: ${fileType}`);
    } catch (error) {
        console.error("Text extraction failed:", error);
        throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
    return text
        .replace(/\s+/g, " ") // normalize whitespace
        .replace(/\n+/g, "\n") // normalize newlines
        .trim();
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = end - overlap;
        
        // Avoid infinite loop if text is very short
        if (start >= text.length) break;
    }
    
    return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Generate embedding for text using Gemini
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const ai = getEmbeddingModel();
        const result = await ai.models.embedContent({
            model: "text-embedding-004", // Gemini's embedding model
            contents: text,
        });
        
        if (!result.embeddings || !Array.isArray(result.embeddings) || result.embeddings.length === 0) {
            throw new Error("Invalid embedding response");
        }
        
        const values = result.embeddings[0].values;
        if (!values) {
            throw new Error("Embedding values are undefined");
        }
        
        return values;
    } catch (error) {
        console.error("Embedding generation failed:", error);
        throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Process document: extract text, chunk, generate embeddings, and store
 */
export async function processDocument(
    userId: string,
    documentId: string,
    buffer: Buffer,
    fileName: string,
    fileType: string
): Promise<void> {
    try {
        // Extract and clean text
        const rawText = await extractText(buffer, fileType);
        const cleanedText = cleanText(rawText);
        
        if (cleanedText.length < 50) {
            throw new Error("Document contains insufficient text content");
        }
        
        // Split into chunks
        const chunks = chunkText(cleanedText);
        
        // Generate embeddings and store chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await generateEmbedding(chunk);
            
            await KnowledgeChunk.create({
                userId,
                documentId,
                text: chunk,
                embedding,
                chunkIndex: i,
                metadata: {
                    fileName,
                    fileType,
                    charCount: chunk.length,
                },
            });
        }
        
        // Update document status
        await Document.findByIdAndUpdate(documentId, {
            status: "completed",
            chunkCount: chunks.length,
        });
        
        console.log(`[Knowledge] Processed document ${fileName}: ${chunks.length} chunks`);
    } catch (error) {
        console.error(`[Knowledge] Failed to process document ${fileName}:`, error);
        
        // Update document status to failed
        await Document.findByIdAndUpdate(documentId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Processing failed",
        });
        
        throw error;
    }
}

/**
 * Retrieve relevant knowledge chunks for a query
 */
export async function retrieveKnowledge(userId: string, query: string, topK: number = TOP_K_RESULTS): Promise<string[]> {
    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);
        
        // Get all chunks for this user
        const chunks = await KnowledgeChunk.find({ userId }).lean();
        
        if (chunks.length === 0) {
            return [];
        }
        
        // Calculate similarity scores
        const scoredChunks = chunks.map((chunk) => ({
            text: chunk.text,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
            metadata: chunk.metadata,
        }));
        
        // Sort by relevance and take top K
        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, topK);
        
        console.log(`[Knowledge] Retrieved ${topChunks.length} relevant chunks (scores: ${topChunks.map(c => c.score.toFixed(3)).join(", ")})`);
        
        // Return only text from relevant chunks
        return topChunks.map((chunk) => chunk.text);
    } catch (error) {
        console.error("[Knowledge] Retrieval failed:", error);
        // Don't throw - allow generation to continue without context
        return [];
    }
}

/**
 * Delete all chunks associated with a document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
    await KnowledgeChunk.deleteMany({ documentId });
}
