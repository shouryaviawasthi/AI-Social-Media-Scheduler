import mongoose, { Schema } from "mongoose";

export type SocialPlatform = "instagram" | "facebook" | "linkedin";

export interface SocialAccountDocument extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    platform: SocialPlatform;
    platformUserId: string;
    username?: string;
    displayName: string;
    profileImage?: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string;
    expiresAt?: Date;
    connected: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const socialAccountSchema = new Schema<SocialAccountDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true, index: true },
        platform: { type: String, enum: ["instagram", "facebook", "linkedin"], required: true },
        platformUserId: { type: String, required: true },
        username: { type: String },
        displayName: { type: String, required: true },
        profileImage: { type: String },
        accessTokenEncrypted: { type: String, required: true },
        refreshTokenEncrypted: { type: String },
        expiresAt: { type: Date },
        connected: { type: Boolean, default: true },
    },
    { timestamps: true },
);

socialAccountSchema.index({ userId: 1, platform: 1, platformUserId: 1 }, { unique: true });

export default mongoose.model<SocialAccountDocument>("SocialAccount", socialAccountSchema);
