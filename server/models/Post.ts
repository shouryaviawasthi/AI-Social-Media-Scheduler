import mongoose, { Schema } from "mongoose";

export interface PostDocument extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    legacyId?: string;
    content: string;
    platforms: string[];
    scheduledFor?: Date;
    status: "scheduled" | "published";
    publishedPlatforms: string[];
    mediaType?: string;
    mediaUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const postSchema = new Schema<PostDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true, index: true },
        legacyId: { type: String, sparse: true, unique: true },
        content: { type: String, required: true },
        platforms: { type: [String], required: true, default: [] },
        scheduledFor: { type: Date },
        status: { type: String, enum: ["scheduled", "published"], required: true },
        publishedPlatforms: { type: [String], default: [] },
        mediaType: { type: String },
        mediaUrl: { type: String },
    },
    { timestamps: true },
);

postSchema.index({ userId: 1, scheduledFor: 1 });

export default mongoose.model<PostDocument>("Post", postSchema);
