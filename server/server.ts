import dns from "dns";
import "dotenv/config";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import connectDB from "./config/db.js";
import { authRouter } from "./auth.js";
import { socialRouter } from "./socialRoutes.js";
import { contentRouter } from "./contentRoutes.js";
import { knowledgeRouter } from "./knowledgeRoutes.js";
import { startScheduler } from "./scheduler.js";
import { retrieveKnowledge } from "./services/knowledgeService.js";
import { requirePortalUser } from "./auth.js";
const app = express();
// =====================================================
// DATABASE
// =====================================================
console.log("=================================");
console.log("STARTING SERVER");
console.log("=================================");
try {
    await connectDB();
    console.log("MongoDB connection successful.");
    startScheduler();
}
catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
}
// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:5173",
        "https://constrain-kerchief-levitate.ngrok-free.dev"
    ],
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
const port = process.env.PORT || 3000;
// =====================================================
// ENVIRONMENT DEBUG
// =====================================================
console.log("=================================");
console.log("ENVIRONMENT CHECK");
console.log("=================================");
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("POLLINATIONS_API_KEY exists:", !!process.env.POLLINATIONS_API_KEY);
console.log("NODE_ENV:", process.env.NODE_ENV || "not set");
console.log("PORT:", port);
console.log("=================================");
// =====================================================
// TEST ROUTE
// =====================================================
app.get("/", (_req, res) => {
    res.send("Server is Live!");
});
app.use("/api/auth", authRouter);
app.use("/api", socialRouter);
app.use("/api", contentRouter);
app.use("/api/knowledge", knowledgeRouter);
// =====================================================
// AI GENERATION
// =====================================================
app.post("/api/generate", requirePortalUser, async (req, res) => {
    console.log("");
    console.log("=================================");
    console.log("NEW AI GENERATION REQUEST");
    console.log("=================================");
    try {
        const { prompt, tone, generateImage, useKnowledge } = req.body;
        const userId = req.portalUser!._id.toString();
        
        // =================================================
        // REQUEST DEBUG
        // =================================================
        console.log("Request body:");
        console.log({
            prompt,
            tone,
            generateImage,
            useKnowledge
        });
        console.log("Prompt received:", prompt);
        console.log("Tone received:", tone);
        console.log("Generate image:", generateImage);
        console.log("Use Knowledge:", useKnowledge);
        
        // =================================================
        // VALIDATE PROMPT
        // =================================================
        if (!prompt?.trim()) {
            console.error("ERROR: Prompt is empty.");
            res.status(400).json({
                message: "Prompt is required."
            });
            return;
        }
        
        // =================================================
        // RAG: RETRIEVE RELEVANT KNOWLEDGE
        // =================================================
        let retrievedContext = "";
        if (useKnowledge === true) {
            console.log("");
            console.log("=================================");
            console.log("RAG: RETRIEVING KNOWLEDGE");
            console.log("=================================");
            
            try {
                const relevantChunks = await retrieveKnowledge(userId, prompt);
                if (relevantChunks.length > 0) {
                    retrievedContext = relevantChunks.join("\n\n");
                    console.log(`Retrieved ${relevantChunks.length} relevant knowledge chunks.`);
                    console.log("Context length:", retrievedContext.length, "characters");
                } else {
                    console.log("No relevant knowledge found.");
                }
            } catch (retrievalError) {
                console.warn("Knowledge retrieval failed, continuing without context:", retrievalError);
                // Continue generation even if retrieval fails
            }
        }
        
        // =================================================
        // IMAGE GENERATION
        // POLLINATIONS AI
        // =================================================
        if (generateImage === true) {
            console.log("");
            console.log("=================================");
            console.log("IMAGE GENERATION STARTED");
            console.log("Provider: Pollinations AI");
            console.log("=================================");
            // ---------------------------------------------
            // CHECK API KEY
            // ---------------------------------------------
            console.log("Pollinations API key exists:", !!process.env.POLLINATIONS_API_KEY);
            if (!process.env.POLLINATIONS_API_KEY) {
                console.error("ERROR: POLLINATIONS_API_KEY is missing.");
                res.status(503).json({
                    message: "POLLINATIONS_API_KEY is not configured on the server."
                });
                return;
            }
            console.log("Pollinations API key detected.");
            // ---------------------------------------------
            // CREATE IMAGE PROMPT (with optional knowledge context)
            // ---------------------------------------------
            let imagePrompt = `
Create a high-quality social media post image.

User's idea:
${prompt.trim()}

Tone:
${tone || "Professional"}`;

            if (retrievedContext) {
                imagePrompt += `\n\nContext from Knowledge Base:
${retrievedContext.substring(0, 500)}`;
            }

            imagePrompt += `\n\nRequirements:
- Create an attractive and visually engaging image.
- Clearly represent the user's idea.
- Suitable for a social media post.
- Square 1:1 composition.
- High visual quality.
- Professional composition.
- Good lighting.
- Make the main subject clear and visually interesting.
- Do not add unnecessary UI elements.
- Do not add watermarks.
`;
            console.log("");
            console.log("IMAGE PROMPT:");
            console.log(imagePrompt);
            // ---------------------------------------------
            // ENCODE PROMPT
            // ---------------------------------------------
            const encodedPrompt = encodeURIComponent(imagePrompt);
            console.log("");
            console.log("Prompt encoded successfully.");
            // ---------------------------------------------
            // POLLINATIONS URL
            // ---------------------------------------------
            const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}` +
                `?model=flux&width=1024&height=1024`;
            console.log("");
            console.log("POLLINATIONS REQUEST:");
            console.log("URL:", imageUrl);
            console.log("Method: GET");
            console.log("Authorization header present:", !!process.env.POLLINATIONS_API_KEY);
            // ---------------------------------------------
            // SEND REQUEST
            // ---------------------------------------------
            console.log("");
            console.log("Sending request to Pollinations...");
            let imageResponse;
            try {
                imageResponse = await fetch(imageUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`
                    }
                });
            }
            catch (fetchError: any) {
                console.error("");
                console.error("=================================");
                console.error("POLLINATIONS FETCH ERROR");
                console.error("=================================");
                console.error("Fetch failed completely.");
                console.error("Error:", fetchError);
                console.error("Message:", fetchError?.message);
                console.error("Cause:", fetchError?.cause);
                console.error("=================================");
                throw new Error(`Pollinations fetch failed: ${fetchError?.message}`);
            }
            // ---------------------------------------------
            // RESPONSE STATUS
            // ---------------------------------------------
            console.log("");
            console.log("Pollinations response received.");
            console.log("HTTP Status:", imageResponse.status);
            console.log("Status Text:", imageResponse.statusText);
            console.log("OK:", imageResponse.ok);
            console.log("Content-Type:", imageResponse.headers.get("content-type"));
            // ---------------------------------------------
            // HANDLE ERROR RESPONSE
            // ---------------------------------------------
            if (!imageResponse.ok) {
                console.error("");
                console.error("=================================");
                console.error("POLLINATIONS API ERROR");
                console.error("=================================");
                const errorText = await imageResponse.text();
                console.error("Status:", imageResponse.status);
                console.error("Status Text:", imageResponse.statusText);
                console.error("Response:", errorText);
                console.error("=================================");
                throw new Error(`Pollinations API failed: ${imageResponse.status} - ${errorText}`);
            }
            // ---------------------------------------------
            // READ IMAGE
            // ---------------------------------------------
            console.log("");
            console.log("Pollinations returned successful response.");
            console.log("Reading image data...");
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            console.log("Image ArrayBuffer size:", imageArrayBuffer.byteLength, "bytes");
            // ---------------------------------------------
            // CONVERT TO BASE64
            // ---------------------------------------------
            const imageBuffer = Buffer.from(imageArrayBuffer);
            const imageBase64 = imageBuffer.toString("base64");
            console.log("Base64 conversion successful.");
            console.log("Base64 length:", imageBase64.length);
            // ---------------------------------------------
            // CONTENT TYPE
            // ---------------------------------------------
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            console.log("Final image content type:", contentType);
            // ---------------------------------------------
            // SEND IMAGE TO FRONTEND
            // ---------------------------------------------
            console.log("");
            console.log("Sending generated image to frontend...");
            res.json({
                type: "image",
                content: `data:${contentType};base64,${imageBase64}`
            });
            console.log("");
            console.log("=================================");
            console.log("IMAGE GENERATION SUCCESS");
            console.log("=================================");
            return;
        }
        
        // =================================================
        // TEXT GENERATION
        // GEMINI WITH RAG
        // =================================================
        console.log("");
        console.log("=================================");
        console.log("TEXT GENERATION STARTED");
        console.log("Provider: Google Gemini");
        console.log("=================================");
        // ---------------------------------------------
        // CHECK GEMINI API KEY
        // ---------------------------------------------
        console.log("Gemini API key exists:", !!process.env.GEMINI_API_KEY);
        if (!process.env.GEMINI_API_KEY) {
            console.error("ERROR: GEMINI_API_KEY is missing.");
            res.status(503).json({
                message: "GEMINI_API_KEY is not configured on the server."
            });
            return;
        }
        // ---------------------------------------------
        // INITIALIZE GEMINI
        // ---------------------------------------------
        console.log("Initializing Gemini...");
        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
        console.log("Gemini initialized.");
        // ---------------------------------------------
        // BUILD GROUNDED PROMPT WITH RAG
        // ---------------------------------------------
        let textPrompt = "";
        
        if (retrievedContext) {
            // RAG-enhanced prompt
            textPrompt = `You are a social media content assistant.

Use the following retrieved knowledge as the primary source of factual information:

=== RETRIEVED CONTEXT ===
${retrievedContext}
=== END CONTEXT ===

User request:
${prompt.trim()}

Tone:
${tone || "Professional"}

Instructions:
- Use relevant information from the retrieved context above.
- Do not invent company/product facts not mentioned in the context.
- Do not fabricate statistics, features, clients, or claims.
- If the requested information is not available in the context, avoid making up specific facts.
- Follow the requested tone.
- Return only the finished social media post.
- Do not explain your answer.
- Do not add labels such as "Post:".
- Make it engaging and natural.`;
        } else {
            // Standard prompt (no knowledge base)
            textPrompt = `
Create one social media post.

Idea:
${prompt.trim()}

Tone:
${tone || "Professional"}

Requirements:
- Return only the finished social media post.
- Do not explain your answer.
- Do not add labels such as "Post:".
- Make it engaging and natural.
`;
        }
        
        console.log("");
        console.log("TEXT PROMPT:");
        console.log(textPrompt);
        // ---------------------------------------------
        // GEMINI REQUEST
        // ---------------------------------------------
        console.log("");
        console.log("Sending request to Gemini...");
        const models = [...new Set([
            process.env.GEMINI_MODEL || "gemini-3.8-flash",
            process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
            process.env.GEMINI_LAST_RESORT_MODEL || "gemini-3.5-flash-lite",
        ])];
        let response;
        let lastGeminiError: any;
        for (const [index, model] of models.entries()) {
            try {
                response = await ai.models.generateContent({
                    model,
                    contents: textPrompt,
                    config: {
                        httpOptions: {
                            timeout: 12_000,
                            retryOptions: { attempts: 1 },
                        },
                    },
                });
                break;
            } catch (geminiError: any) {
                lastGeminiError = geminiError;
                const status = Number(geminiError?.status);
                const retryable = [408, 429, 500, 502, 503, 504].includes(status)
                    || geminiError?.name === "RequestTimeoutError"
                    || geminiError?.name === "ConnectionError";
                if (!retryable || index === models.length - 1) {
                    throw new Error(`Gemini API failed on ${model}: ${geminiError?.message}`);
                }
                console.warn(`Gemini model ${model} failed (${status || geminiError?.name}); trying ${models[index + 1]}.`);
            }
        }
        if (!response || !response.text?.trim()) {
            throw new Error(`Gemini returned no response. ${lastGeminiError?.message || "Please try again."}`);
        }
        // ---------------------------------------------
        // GEMINI RESPONSE
        // ---------------------------------------------
        console.log("");
        console.log("Gemini response received.");
        console.log("Response text:");
        console.log(response.text);
        // ---------------------------------------------
        // SEND TEXT TO FRONTEND
        // ---------------------------------------------
        res.json({
            type: "text",
            content: response.text
        });
        console.log("");
        console.log("=================================");
        console.log("TEXT GENERATION SUCCESS");
        console.log("=================================");
    }
    catch (error: any) {
        console.error("");
        console.error("=================================");
        console.error("AI GENERATION FAILED");
        console.error("=================================");
        console.error("Error object:", error);
        console.error("Error message:", error?.message);
        console.error("Error status:", error?.status);
        console.error("Error code:", error?.code);
        console.error("Error stack:", error?.stack);
        console.error("=================================");
        res.status(500).json({
            message: error instanceof Error ? error.message : "AI generation failed.",
            error: error?.message ||
                "Unknown error"
        });
    }
});
// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("");
    console.error("GLOBAL ERROR HANDLER:");
    console.error(err);
    res.status(500).send(err?.message ||
        "Internal server error");
});
// =====================================================
// START SERVER
// =====================================================
app.listen(port, () => {
    console.log("");
    console.log("=================================");
    console.log(`Server is running at http://localhost:${port}`);
    console.log("=================================");
    console.log("Ready to receive AI requests.");
});
