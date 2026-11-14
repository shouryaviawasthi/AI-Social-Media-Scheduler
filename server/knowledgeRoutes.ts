import { Router } from "express";
import multer from "multer";
import Document from "./models/Document.js";
import { requirePortalUser } from "./auth.js";
import { processDocument, deleteDocumentChunks } from "./services/knowledgeService.js";

const knowledgeRouter = Router();

// Configure multer for file uploads (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Unsupported file type. Please upload PDF, TXT, or DOCX files."));
        }
    },
});

// All routes require authentication
knowledgeRouter.use(requirePortalUser);

/**
 * GET /api/knowledge - List all documents for authenticated user
 */
knowledgeRouter.get("/", async (req, res, next) => {
    try {
        const documents = await Document.find({ userId: req.portalUser!._id })
            .sort({ createdAt: -1 })
            .lean();
        
        res.json(documents.map((doc) => ({
            _id: doc._id.toString(),
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            status: doc.status,
            error: doc.error,
            chunkCount: doc.chunkCount,
            createdAt: doc.createdAt,
        })));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/knowledge/upload - Upload and process a document
 */
knowledgeRouter.post("/upload", upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }
        
        const { originalname, mimetype, size, buffer } = req.file;
        
        // Create document record
        const document = await Document.create({
            userId: req.portalUser!._id,
            fileName: originalname,
            fileType: mimetype,
            fileSize: size,
            status: "processing",
        });
        
        // Process document asynchronously (don't block the response)
        processDocument(
            req.portalUser!._id.toString(),
            document._id.toString(),
            buffer,
            originalname,
            mimetype
        ).catch((error) => {
            console.error(`[Knowledge] Async processing failed for ${originalname}:`, error);
        });
        
        res.status(201).json({
            _id: document._id.toString(),
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            status: document.status,
            chunkCount: 0,
            createdAt: document.createdAt,
        });
    } catch (error) {
        if (error instanceof multer.MulterError) {
            res.status(400).json({ message: `Upload error: ${error.message}` });
        } else {
            next(error);
        }
    }
});

/**
 * DELETE /api/knowledge/:id - Delete a document and its chunks
 */
knowledgeRouter.delete("/:id", async (req, res, next) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            userId: req.portalUser!._id,
        });
        
        if (!document) {
            res.status(404).json({ message: "Document not found" });
            return;
        }
        
        // Delete associated chunks
        await deleteDocumentChunks(document._id.toString());
        
        // Delete document
        await Document.deleteOne({ _id: document._id });
        
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

export { knowledgeRouter };
