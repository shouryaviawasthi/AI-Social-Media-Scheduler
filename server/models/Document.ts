import mongoose, { Schema } from "mongoose";

export interface DocumentDocument extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: "processing" | "completed" | "failed";
    error?: string;
    chunkCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const documentSchema = new Schema<DocumentDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true, index: true },
        fileName: { type: String, required: true },
        fileType: { type: String, required: true },
        fileSize: { type: Number, required: true },
        status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
        error: { type: String },
        chunkCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

documentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<DocumentDocument>("Document", documentSchema);
