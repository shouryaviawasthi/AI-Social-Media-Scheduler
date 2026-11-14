import mongoose, { Schema } from "mongoose";

export interface ActivityDocument extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    legacyId?: string;
    actionType: string;
    description: string;
    relatedPost?: {
        _id: string;
        content: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "PortalUser", required: true, index: true },
        legacyId: { type: String, sparse: true, unique: true },
        actionType: { type: String, required: true },
        description: { type: String, required: true },
        relatedPost: {
            type: new Schema(
                {
                    _id: { type: String, required: true },
                    content: { type: String, required: true },
                },
                { _id: false },
            ),
            default: null,
        },
    },
    { timestamps: true },
);

activitySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ActivityDocument>("Activity", activitySchema);
