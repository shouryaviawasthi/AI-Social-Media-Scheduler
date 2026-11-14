import { Router } from "express";
import Activity from "./models/Activity.js";
import Post from "./models/Post.js";
import SocialAccount, { type SocialPlatform } from "./models/SocialAccount.js";
import { requirePortalUser } from "./auth.js";
import { publishPostToPlatforms } from "./scheduler.js";

const contentRouter = Router();

// -------------------------------------------------------
// PUBLIC: GET /api/media/:postId
// Returns the image bytes for a post's mediaUrl.
// No authentication required — Instagram's servers must be
// able to fetch this URL directly.
// Only exposes image data belonging to a specific post.
// Does NOT expose tokens, secrets, or arbitrary DB data.
// -------------------------------------------------------
contentRouter.get("/media/:postId", async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.postId).lean();
        if (!post || !post.mediaType?.startsWith("image") || !post.mediaUrl) {
            res.status(404).end();
            return;
        }
        const { mediaUrl } = post;
        // Handle data:image/...;base64,<data> URIs
        const dataUriMatch = mediaUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
        if (dataUriMatch) {
            const mimeType = dataUriMatch[1];
            const imageBuffer = Buffer.from(dataUriMatch[2], "base64");
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Length", imageBuffer.length);
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.end(imageBuffer);
            return;
        }
        // Handle plain https:// URLs — redirect so the client fetches directly
        if (mediaUrl.startsWith("https://") || mediaUrl.startsWith("http://")) {
            res.redirect(mediaUrl);
            return;
        }
        res.status(404).end();
    } catch (error) { next(error); }
});

contentRouter.use(requirePortalUser);

const postView = (post: typeof Post.prototype) => ({
    _id: post._id.toString(),
    userId: post.userId.toString(),
    content: post.content,
    platforms: post.platforms,
    scheduledFor: post.scheduledFor?.toISOString(),
    status: post.status,
    publishedPlatforms: post.publishedPlatforms || [],
    mediaType: post.mediaType,
    mediaUrl: post.mediaUrl,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
});

const activityView = (activity: typeof Activity.prototype) => ({
    _id: activity._id.toString(),
    userId: activity.userId.toString(),
    actionType: activity.actionType,
    description: activity.description,
    relatedPost: activity.relatedPost || null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
});

const parseScheduledFor = (value: unknown) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
        throw new Error("scheduledFor must be a valid date.");
    }
    return new Date(value);
};

contentRouter.get("/posts", async (req, res, next) => {
    try {
        const posts = await Post.find({ userId: req.portalUser!._id }).sort({ createdAt: -1 });
        res.json(posts.map(postView));
    } catch (error) { next(error); }
});

contentRouter.post("/posts", async (req, res, next) => {
    try {
        const { content, platforms, scheduledFor, status, mediaType, mediaUrl, legacyId } = req.body as Record<string, unknown>;
        if (typeof content !== "string" || !content.trim() || !Array.isArray(platforms) || platforms.length === 0) {
            res.status(400).json({ message: "Content and at least one platform are required." });
            return;
        }
        const postPlatforms = platforms.filter((platform): platform is string => typeof platform === "string");
        if (postPlatforms.length === 0 || postPlatforms.some((platform) => !["instagram", "facebook", "linkedin"].includes(platform))) {
            res.status(400).json({ message: "Choose a supported platform: Instagram, Facebook, or LinkedIn." });
            return;
        }
        if (status !== "scheduled" && status !== "published") {
            res.status(400).json({ message: "status must be scheduled or published." });
            return;
        }
        if (
            status === "scheduled" &&
            postPlatforms.includes("instagram") &&
            (typeof mediaType !== "string" || !mediaType.startsWith("image") || typeof mediaUrl !== "string" || !mediaUrl)
        ) {
            res.status(400).json({ message: "Instagram scheduled posts require an attached image." });
            return;
        }
        const parsedDate = parseScheduledFor(scheduledFor);
        if (typeof legacyId === "string" && await Post.exists({ legacyId })) {
            const existing = await Post.findOne({ legacyId });
            if (existing?.userId.equals(req.portalUser!._id)) {
                res.status(200).json(postView(existing));
                return;
            }
        }
        const connectedAccounts = await SocialAccount.find({
            userId: req.portalUser!._id,
            platform: { $in: postPlatforms as SocialPlatform[] },
            connected: true,
        }).select("platform").lean();
        const connectedPlatforms = new Set(connectedAccounts.map((account) => account.platform));
        const missingPlatforms = postPlatforms.filter((platform) => !connectedPlatforms.has(platform as "instagram" | "facebook" | "linkedin"));
        if (missingPlatforms.length > 0) {
            res.status(400).json({ message: `Connect ${missingPlatforms.join(" and ")} before scheduling.` });
            return;
        }
        const post = await Post.create({
            userId: req.portalUser!._id,
            legacyId: typeof legacyId === "string" ? legacyId : undefined,
            content: content.trim(),
            platforms: postPlatforms,
            scheduledFor: parsedDate,
            status,
            mediaType: typeof mediaType === "string" ? mediaType : undefined,
            mediaUrl: typeof mediaUrl === "string" ? mediaUrl : undefined,
        });
        res.status(201).json(postView(post));
    } catch (error) { next(error); }
});

contentRouter.put("/posts/:id", async (req, res, next) => {
    try {
        const updates: Record<string, unknown> = {};
        const body = req.body as Record<string, unknown>;
        if (typeof body.content === "string" && body.content.trim()) updates.content = body.content.trim();
        if (Array.isArray(body.platforms)) updates.platforms = body.platforms;
        if (body.scheduledFor !== undefined) updates.scheduledFor = parseScheduledFor(body.scheduledFor);
        if (body.status === "scheduled" || body.status === "published") updates.status = body.status;
        if (typeof body.mediaType === "string" || body.mediaType === null) updates.mediaType = body.mediaType || undefined;
        if (typeof body.mediaUrl === "string" || body.mediaUrl === null) updates.mediaUrl = body.mediaUrl || undefined;

        const post = await Post.findOneAndUpdate(
            { _id: req.params.id, userId: req.portalUser!._id },
            { $set: updates },
            { new: true, runValidators: true },
        );
        if (!post) {
            res.status(404).json({ message: "Post not found." });
            return;
        }
        res.json(postView(post));
    } catch (error) { next(error); }
});

contentRouter.delete("/posts/:id", async (req, res, next) => {
    try {
        const result = await Post.deleteOne({ _id: req.params.id, userId: req.portalUser!._id });
        if (!result.deletedCount) {
            res.status(404).json({ message: "Post not found." });
            return;
        }
        res.status(204).end();
    } catch (error) { next(error); }
});

contentRouter.get("/activities", async (req, res, next) => {
    try {
        const activities = await Activity.find({ userId: req.portalUser!._id }).sort({ createdAt: -1 });
        res.json(activities.map(activityView));
    } catch (error) { next(error); }
});

contentRouter.post("/activities", async (req, res, next) => {
    try {
        const { actionType, description, relatedPost, legacyId } = req.body as Record<string, unknown>;
        if (typeof actionType !== "string" || !actionType || typeof description !== "string" || !description) {
            res.status(400).json({ message: "actionType and description are required." });
            return;
        }
        if (typeof legacyId === "string") {
            const existing = await Activity.findOne({ legacyId, userId: req.portalUser!._id });
            if (existing) {
                res.status(200).json(activityView(existing));
                return;
            }
        }
        const activity = await Activity.create({
            userId: req.portalUser!._id,
            legacyId: typeof legacyId === "string" ? legacyId : undefined,
            actionType,
            description,
            relatedPost: relatedPost && typeof relatedPost === "object" ? relatedPost : null,
        });
        res.status(201).json(activityView(activity));
    } catch (error) { next(error); }
});

contentRouter.post("/posts/:postId/publish", async (req, res, next) => {
    try {
        const postId = req.params.postId;
        await publishPostToPlatforms(postId, req.portalUser!._id.toString());
        res.json({ message: "Post published successfully.", postId });
    } catch (error) {
        const message = error instanceof Error ? error.message : "An error occurred during publishing.";
        res.status(message === "Post not found." ? 404 : 502).json({ message });
    }
});

export { contentRouter };
