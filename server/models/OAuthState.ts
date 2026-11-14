import mongoose, { Schema } from "mongoose";

export type OAuthProvider = "instagram" | "facebook" | "linkedin";

export interface OAuthStateDocument extends mongoose.Document {
    stateHash: string;
    userId: mongoose.Types.ObjectId;
    provider: OAuthProvider;
    purpose: "connect" | "facebook-page-selection";
    payloadEncrypted?: string;
    expiresAt: Date;
}

const oauthStateSchema = new Schema<OAuthStateDocument>({
    stateHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true },
    provider: { type: String, enum: ["instagram", "facebook", "linkedin"], required: true },
    purpose: { type: String, enum: ["connect", "facebook-page-selection"], required: true },
    payloadEncrypted: { type: String },
    expiresAt: { type: Date, required: true },
});

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<OAuthStateDocument>("OAuthState", oauthStateSchema);
