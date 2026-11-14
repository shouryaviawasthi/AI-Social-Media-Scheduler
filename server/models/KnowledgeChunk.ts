import mongoose, { Schema } from "mongoose";

export interface KnowledgeChunkDocument extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    documentId: mongoose.Types.ObjectId;
    text: string;
    embedding: number[];
    chunkIndex: number;
    metadata: {
        fileName?: string;
        fileType?: string;
        charCount?: number;
    };
    createdAt: Date;
}

const knowledgeChunkSchema = new Schema<KnowledgeChunkDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true, index: true },
        documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
        text: { type: String, required: true },
        embedding: { type: [Number], required: true },
        chunkIndex: { type: Number, required: true },
        metadata: {
            fileName: String,
            fileType: String,
            charCount: Number,
        },
    },
    { timestamps: true },
);

// Compound index for user-scoped retrieval
knowledgeChunkSchema.index({ userId: 1, documentId: 1 });

export default mongoose.model<KnowledgeChunkDocument>("KnowledgeChunk", knowledgeChunkSchema);
