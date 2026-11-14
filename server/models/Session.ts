import mongoose, { Schema } from "mongoose";

export interface SessionDocument extends mongoose.Document {
    tokenHash: string;
    userId: mongoose.Types.ObjectId;
    expiresAt: Date;
}

const sessionSchema = new Schema<SessionDocument>({
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true },
    expiresAt: { type: Date, required: true },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<SessionDocument>("Session", sessionSchema);
