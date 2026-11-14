import Activity from "./models/Activity.js";
import Post from "./models/Post.js";
import SocialAccount from "./models/SocialAccount.js";
import { decryptSecret } from "./security.js";

type PublishPlatform = "instagram" | "facebook" | "linkedin";
type ApiPayload = Record<string, unknown>;
type ImageAsset = { bytes: Buffer; contentType: string };

const supportedPlatforms: PublishPlatform[] = ["instagram", "facebook", "linkedin"];
const inFlight = new Set<string>();

const readPayload = async (response: Response): Promise<ApiPayload> => {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as ApiPayload;
    } catch {
        return { message: text };
    }
};

const apiError = (payload: ApiPayload, fallback: string) => {
    const error = payload.error;
    if (error && typeof error === "object" && "message" in error) {
        return String((error as { message: unknown }).message);
    }
    if (typeof payload.message === "string") return payload.message;
    return fallback;
};

const loadImage = async (mediaUrl: string): Promise<ImageAsset> => {
    let bytes: Buffer;
    let contentType: string;
    const match = mediaUrl.match(/^data:(image\/(?:jpeg|png|gif));base64,([\s\S]+)$/i);

    if (match) {
        contentType = match[1].toLowerCase();
        bytes = Buffer.from(match[2], "base64");
    } else if (mediaUrl.startsWith("https://") || mediaUrl.startsWith("http://")) {
        const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`Unable to download image (${response.status}).`);
        contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
        if (!/^image\/(jpeg|png|gif)$/.test(contentType)) {
            throw new Error("Images must be JPG, PNG, or GIF files.");
        }
        bytes = Buffer.from(await response.arrayBuffer());
    } else {
        throw new Error("The image is not in a supported format.");
    }

    if (bytes.length === 0 || bytes.length > 7 * 1024 * 1024) {
        throw new Error("Images must be smaller than 7 MB.");
    }
    return { bytes, contentType };
};

const publishToFacebook = async (post: typeof Post.prototype, accessToken: string, pageId: string) => {
    const apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
    let response: Response;

    if (post.mediaType?.startsWith("image") && post.mediaUrl) {
        const image = await loadImage(post.mediaUrl);
        const form = new FormData();
        form.set("source", new Blob([Uint8Array.from(image.bytes).buffer], { type: image.contentType }), `post.${image.contentType.split("/")[1]}`);
        form.set("message", post.content);
        form.set("access_token", accessToken);
        response = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/photos`, {
            method: "POST",
            body: form,
        });
    } else {
        response = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/feed`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ message: post.content, access_token: accessToken }),
        });
    }

    const payload = await readPayload(response);
    if (!response.ok || !payload.id) {
        throw new Error(`Facebook publish failed: ${apiError(payload, `HTTP ${response.status}`)}`);
    }
};

const publishToLinkedIn = async (post: typeof Post.prototype, accessToken: string, memberId: string) => {
    const version = process.env.LINKEDIN_API_VERSION || "202609";
    const author = memberId.startsWith("urn:li:") ? memberId : `urn:li:person:${memberId}`;
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Linkedin-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
    };
    let imageUrn: string | undefined;

    if (post.mediaType?.startsWith("image") && post.mediaUrl) {
        const image = await loadImage(post.mediaUrl);
        const initializeResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
            method: "POST",
            headers,
            body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
        });
        const initializePayload = await readPayload(initializeResponse);
        const upload = initializePayload.value as { uploadUrl?: string; image?: string } | undefined;
        if (!initializeResponse.ok || !upload?.uploadUrl || !upload.image) {
            throw new Error(`LinkedIn image upload setup failed: ${apiError(initializePayload, `HTTP ${initializeResponse.status}`)}`);
        }

        const uploadResponse = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": image.contentType },
            body: Uint8Array.from(image.bytes).buffer,
        });
        if (!uploadResponse.ok) throw new Error(`LinkedIn image upload failed (HTTP ${uploadResponse.status}).`);
        imageUrn = upload.image;
    }

    const payload: ApiPayload = {
        author,
        commentary: post.content,
        visibility: "PUBLIC",
        distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
    };
    if (imageUrn) payload.content = { media: { id: imageUrn, altText: post.content.slice(0, 4000) } };

    const response = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });
    const responsePayload = await readPayload(response);
    if (!response.ok) {
        throw new Error(`LinkedIn publish failed: ${apiError(responsePayload, `HTTP ${response.status}`)}`);
    }
};

const publishToInstagram = async (post: typeof Post.prototype, accessToken: string, instagramUserId: string) => {
    if (!post.mediaType?.startsWith("image") || !post.mediaUrl) {
        throw new Error("Instagram posts require an image.");
    }
    const apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const imageUrl = `${backendUrl}/api/media/${post._id}`;
    const containerResponse = await fetch(`https://graph.instagram.com/${apiVersion}/${instagramUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image_url: imageUrl, caption: post.content, access_token: accessToken }),
    });
    const containerPayload = await readPayload(containerResponse);
    if (!containerResponse.ok || !containerPayload.id) {
        throw new Error(`Instagram media setup failed: ${apiError(containerPayload, `HTTP ${containerResponse.status}`)}`);
    }

    const publishResponse = await fetch(`https://graph.instagram.com/${apiVersion}/${instagramUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: String(containerPayload.id), access_token: accessToken }),
    });
    const publishPayload = await readPayload(publishResponse);
    if (!publishResponse.ok || !publishPayload.id) {
        throw new Error(`Instagram publish failed: ${apiError(publishPayload, `HTTP ${publishResponse.status}`)}`);
    }
};

const publishToPlatform = async (post: typeof Post.prototype, platform: PublishPlatform) => {
    const account = await SocialAccount.findOne({ userId: post.userId, platform, connected: true });
    if (!account) throw new Error(`Connect a ${platform} account before publishing this post.`);
    const accessToken = decryptSecret(account.accessTokenEncrypted);

    if (platform === "facebook") return publishToFacebook(post, accessToken, account.platformUserId);
    if (platform === "linkedin") return publishToLinkedIn(post, accessToken, account.platformUserId);
    return publishToInstagram(post, accessToken, account.platformUserId);
};

export async function publishPostToPlatforms(postId: string, userId?: string): Promise<void> {
    const id = postId.toString();
    if (inFlight.has(id)) throw new Error("This post is already being published.");
    inFlight.add(id);

    try {
        const post = await Post.findOne({ _id: id, ...(userId ? { userId } : {}) });
        if (!post) throw new Error("Post not found.");
        if (post.status === "published") throw new Error("Post is already published.");

        const platforms = [...new Set(post.platforms)];
        if (platforms.length === 0) throw new Error("Choose at least one platform before publishing.");

        for (const platform of platforms) {
            if (!supportedPlatforms.includes(platform as PublishPlatform)) {
                throw new Error(`Publishing to ${platform} is not supported yet.`);
            }
            if (post.publishedPlatforms?.includes(platform)) continue;

            await publishToPlatform(post, platform as PublishPlatform);
            post.publishedPlatforms = [...new Set([...(post.publishedPlatforms || []), platform])];
            await post.save();
        }

        if (platforms.every((platform) => post.publishedPlatforms.includes(platform))) {
            post.status = "published";
            await post.save();
            await Activity.create({
                userId: post.userId,
                actionType: "POST_PUBLISHED",
                description: `Published post to ${platforms.join(", ")}`,
                relatedPost: { _id: post._id.toString(), content: post.content },
            });
            console.log(`[scheduler] Post ${id} published to ${platforms.join(", ")}.`);
        }
    } finally {
        inFlight.delete(id);
    }
}

async function processDuePosts(): Promise<void> {
    const duePosts = await Post.find({
        status: "scheduled",
        scheduledFor: { $exists: true, $lte: new Date() },
        platforms: { $in: supportedPlatforms },
    }).select("_id").lean();

    for (const { _id } of duePosts) {
        const id = _id.toString();
        if (inFlight.has(id)) continue;
        publishPostToPlatforms(id).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[scheduler] Post ${id} was not fully published: ${message}`);
        });
    }
}

export function startScheduler(): void {
    console.log("[scheduler] Auto-publish scheduler started (interval: 45s).");
    processDuePosts().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[scheduler] Startup scan error: ${message}`);
    });
    setInterval(() => {
        processDuePosts().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[scheduler] Scheduled scan error: ${message}`);
        });
    }, 45_000);
}
