import mongoose, { Schema } from "mongoose";

export interface PortalUserDocument extends mongoose.Document {
    legacyId?: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}

const portalUserSchema = new Schema<PortalUserDocument>(
    {
        legacyId: { type: String, sparse: true, unique: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true },
);

export default mongoose.model<PortalUserDocument>("PortalUser", portalUserSchema);
