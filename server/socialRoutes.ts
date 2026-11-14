import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import OAuthState, { type OAuthProvider } from "./models/OAuthState.js";
import SocialAccount from "./models/SocialAccount.js";
import { encryptSecret, decryptSecret, createOAuthState, hashOAuthState } from "./security.js";
import { requirePortalUser } from "./auth.js";

type JsonRecord = Record<string, unknown>;
type FacebookPage = { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } };

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
const stateLifetimeMs = 10 * 60 * 1000;

const requiredEnv = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured.`);
    return value;
};

const redirect = (res: Response, path: string, params?: Record<string, string>) => {
    const url = new URL(path, frontendUrl);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    res.redirect(url.toString());
};

const providerError = (provider: string, error: unknown) => {
    console.error(`${provider} OAuth failed:`, error);
};

const exchangeJson = async (url: string, init?: RequestInit): Promise<JsonRecord> => {
    const response = await fetch(url, init);
    const payload = await response.json() as JsonRecord;
    if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
    return payload;
};

const createStateRecord = async (req: Request, provider: OAuthProvider, purpose: "connect" | "facebook-page-selection" = "connect", payloadEncrypted?: string) => {
    const state = createOAuthState();
    await OAuthState.create({
        stateHash: hashOAuthState(state),
        userId: req.portalUser!._id,
        provider,
        purpose,
        payloadEncrypted,
        expiresAt: new Date(Date.now() + stateLifetimeMs),
    });
    return state;
};

const consumeState = async (state: string, provider: OAuthProvider, purpose: "connect" | "facebook-page-selection" = "connect") => {
    const record = await OAuthState.findOneAndDelete({ stateHash: hashOAuthState(state), provider, purpose, expiresAt: { $gt: new Date() } });
    if (!record) throw new Error("Invalid or expired OAuth state.");
    return record;
};

const saveAccount = async (userId: string, values: {
    platform: OAuthProvider;
    platformUserId: string;
    username?: string;
    displayName: string;
    profileImage?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
}) => {
    await SocialAccount.findOneAndUpdate(
        { userId, platform: values.platform, platformUserId: values.platformUserId },
        {
            userId,
            platform: values.platform,
            platformUserId: values.platformUserId,
            username: values.username,
            displayName: values.displayName,
            profileImage: values.profileImage,
            accessTokenEncrypted: encryptSecret(values.accessToken),
            refreshTokenEncrypted: values.refreshToken ? encryptSecret(values.refreshToken) : undefined,
            expiresAt: values.expiresAt,
            connected: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
};

const accountView = (account: typeof SocialAccount.prototype) => ({
    id: account._id.toString(),
    platform: account.platform,
    platformUserId: account.platformUserId,
    username: account.username,
    displayName: account.displayName,
    profileImage: account.profileImage,
    connected: account.connected,
});

export const socialRouter = Router();

socialRouter.use((req, res, next) => {
    // Instagram OAuth callback comes from Meta through the public ngrok URL,
    // so the localhost session cookie is not available here.
    // The callback is protected by the one-time OAuth state.
    if (req.path === "/instagram/callback") {
        next();
        return;
    }

    requirePortalUser(req, res, next);
});

socialRouter.get("/social/accounts", async (req, res, next) => {
    try {
        const accounts = await SocialAccount.find({ userId: req.portalUser!._id, connected: true }).sort({ createdAt: 1 });
        res.json(accounts.map(accountView));
    } catch (error) { next(error); }
});

socialRouter.get("/instagram/connect", async (req, res, next) => {
    try {
        console.log("[Instagram] OAuth started");
        const state = await createStateRecord(req, "instagram");
        // Use Facebook OAuth with Instagram permissions instead of direct Instagram OAuth
        const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
        url.searchParams.set("client_id", requiredEnv("META_APP_ID"));
        url.searchParams.set("redirect_uri", requiredEnv("INSTAGRAM_REDIRECT_URI"));
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement");
        url.searchParams.set("state", state);
        res.redirect(url.toString());
    } catch (error) {
        console.error("INSTAGRAM CONNECT ERROR:", error)
        providerError("Instagram", error);
        redirect(res, "/oauth/instagram/error", { message: "Instagram connection failed." });
    }
});

socialRouter.get("/instagram/callback", async (req, res) => {
    console.log("[Instagram] callback received");
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    try {
        if (error || !code || !state) throw new Error("Instagram authorization was cancelled or incomplete.");
        const stateRecord = await consumeState(state, "instagram");
        console.log("[Instagram] state consumed");
        
        // Exchange code for access token using Meta Graph API
        const token = await exchangeJson(`https://graph.facebook.com/${apiVersion}/oauth/access_token?${new URLSearchParams({ 
            client_id: requiredEnv("META_APP_ID"), 
            client_secret: requiredEnv("META_APP_SECRET"), 
            redirect_uri: requiredEnv("INSTAGRAM_REDIRECT_URI"), 
            code 
        })}`);
        
        console.log("[Instagram] token exchange successful");
        const accessToken = String(token.access_token || "");
        
        // Get user's Facebook pages to find Instagram Business accounts
        const pagesPayload = await exchangeJson(`https://graph.facebook.com/${apiVersion}/me/accounts?${new URLSearchParams({ 
            fields: "id,name,access_token", 
            access_token: accessToken 
        })}`);
        
        const pages = (Array.isArray(pagesPayload.data) ? pagesPayload.data : []) as { id: string; name: string; access_token: string }[];
        
        // Find Instagram Business accounts connected to these pages
        for (const page of pages) {
            try {
                const igAccount = await exchangeJson(`https://graph.facebook.com/${apiVersion}/${page.id}?${new URLSearchParams({ 
                    fields: "instagram_business_account", 
                    access_token: page.access_token 
                })}`);
                
                const instagramBusinessAccount = igAccount.instagram_business_account as { id: string } | undefined;
                if (instagramBusinessAccount?.id) {
                    const igUserId = instagramBusinessAccount.id;
                    const profile = await exchangeJson(`https://graph.facebook.com/${apiVersion}/${igUserId}?${new URLSearchParams({ 
                        fields: "id,username,name,profile_picture_url", 
                        access_token: page.access_token 
                    })}`);
                    
                    await saveAccount(stateRecord.userId.toString(), {
                        platform: "instagram",
                        platformUserId: String(profile.id),
                        username: typeof profile.username === "string" ? `@${profile.username}` : undefined,
                        displayName: String(profile.name || profile.username || "Instagram Business account"),
                        profileImage: typeof profile.profile_picture_url === "string" ? profile.profile_picture_url : undefined,
                        accessToken: page.access_token,
                    });
                    
                    console.log("[Instagram] account saved");
                    console.log("[Instagram] OAuth success");
                    redirect(res, "/oauth/instagram/success");
                    return;
                }
            } catch (igError) {
                console.log(`[Instagram] Page ${page.id} has no Instagram Business account`);
                continue;
            }
        }
        
        throw new Error("No Instagram Business accounts found. Please connect an Instagram Business account to your Facebook page first.");
    } catch (error) {
        console.error("[Instagram] OAuth error details:", error);
        providerError("Instagram", error);
        
        let errorMessage = "Instagram connection failed.";
        if (error instanceof Error) {
            if (error.message.includes("Instagram Business accounts")) {
                errorMessage = "No Instagram Business accounts found. Please: 1) Convert your Instagram to a Business/Creator account, 2) Link it to a Facebook Page in Instagram settings, 3) Try connecting again.";
            } else if (error.message.includes("cancelled") || error.message.includes("incomplete")) {
                errorMessage = "Instagram authorization was cancelled. Please try again and approve all permissions.";
            } else {
                errorMessage = error.message;
            }
        }
        
        redirect(res, "/oauth/instagram/error", { message: errorMessage });
    }
});

socialRouter.get("/facebook/connect", async (req, res, next) => {
    try {
        const state = await createStateRecord(req, "facebook");
        const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
        url.searchParams.set("client_id", requiredEnv("META_APP_ID"));
        url.searchParams.set("redirect_uri", requiredEnv("FACEBOOK_REDIRECT_URI"));
        url.searchParams.set("state", state);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts");
        // Facebook Login for Business - use Configuration ID if configured
        const configId = process.env.META_CONFIG_ID;
        if (configId) {
            url.searchParams.set("config_id", configId);
        }
        res.redirect(url.toString());
    } catch (error) {
        providerError("Facebook", error);
        redirect(res, "/accounts", { error: "Facebook connection failed." });
    }
});

socialRouter.get("/facebook/callback", async (req, res) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    try {
        if (error || !code || !state) throw new Error("Facebook authorization was cancelled or incomplete.");
        const stateRecord = await consumeState(state, "facebook");
        const token = await exchangeJson(`https://graph.facebook.com/${apiVersion}/oauth/access_token?${new URLSearchParams({ client_id: requiredEnv("META_APP_ID"), client_secret: requiredEnv("META_APP_SECRET"), redirect_uri: requiredEnv("FACEBOOK_REDIRECT_URI"), code })}`);
        const pagesPayload = await exchangeJson(`https://graph.facebook.com/${apiVersion}/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,picture", access_token: String(token.access_token) })}`);
        const pages = (Array.isArray(pagesPayload.data) ? pagesPayload.data : []) as FacebookPage[];
        if (pages.length === 0) throw new Error("No Facebook Pages are available for this account.");
        const selectionState = await createStateRecord(req, "facebook", "facebook-page-selection", encryptSecret(JSON.stringify({ pages, userAccessToken: String(token.access_token) })));
        
        // Redirect to frontend page selection in popup
        redirect(res, "/oauth/facebook/pages", { state: selectionState });
    } catch (error) {
        console.error("[Facebook] OAuth error details:", error);
        providerError("Facebook", error);
        
        let errorMessage = "Facebook connection failed.";
        if (error instanceof Error) {
            if (error.message.includes("No Facebook Pages")) {
                errorMessage = "No Facebook Pages found. Please create a Facebook Page first, then try connecting again.";
            } else if (error.message.includes("cancelled") || error.message.includes("incomplete")) {
                errorMessage = "Facebook authorization was cancelled. Please try again and approve all permissions.";
            } else {
                errorMessage = error.message;
            }
        }
        
        // Redirect to frontend error page in popup
        redirect(res, "/oauth/facebook/error", { message: errorMessage });
    }
});

socialRouter.get("/facebook/pending/:state", async (req, res) => {
    try {
        const record = await OAuthState.findOne({ stateHash: hashOAuthState(req.params.state), provider: "facebook", purpose: "facebook-page-selection", userId: req.portalUser!._id, expiresAt: { $gt: new Date() } });
        if (!record?.payloadEncrypted) { res.status(404).json({ message: "Facebook page selection expired." }); return; }
        const payload = JSON.parse(decryptSecret(record.payloadEncrypted)) as { pages: FacebookPage[] };
        res.json({ pages: payload.pages.map((page) => ({ id: page.id, name: page.name, profileImage: page.picture?.data?.url })) });
    } catch (error) { res.status(400).json({ message: "Unable to load Facebook Pages." }); }
});

socialRouter.post("/facebook/select-page", async (req, res, next) => {
    try {
        const { state, pageId } = req.body as { state?: string; pageId?: string };
        if (!state || !pageId) { res.status(400).json({ message: "A Facebook Page is required." }); return; }
        const record = await OAuthState.findOne({ stateHash: hashOAuthState(state), provider: "facebook", purpose: "facebook-page-selection", userId: req.portalUser!._id, expiresAt: { $gt: new Date() } });
        if (!record?.payloadEncrypted) { res.status(404).json({ message: "Facebook page selection expired." }); return; }
        const payload = JSON.parse(decryptSecret(record.payloadEncrypted)) as { pages: FacebookPage[]; userAccessToken: string };
        const page = payload.pages.find((item) => item.id === pageId);
        if (!page) { res.status(404).json({ message: "Facebook Page was not found." }); return; }
        await OAuthState.deleteOne({ _id: record._id });
        await saveAccount(req.portalUser!._id.toString(), { platform: "facebook", platformUserId: page.id, displayName: page.name, profileImage: page.picture?.data?.url, accessToken: page.access_token || payload.userAccessToken });
        res.json({ connected: true });
    } catch (error) {
        providerError("LinkedIn", error);
        redirect(res, "/accounts", { error: "LinkedIn connection failed." });
    }
});

socialRouter.get("/linkedin/connect", async (req, res, next) => {
    try {
        const state = await createStateRecord(req, "linkedin");
        const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", requiredEnv("LINKEDIN_CLIENT_ID"));
        url.searchParams.set("redirect_uri", requiredEnv("LINKEDIN_REDIRECT_URI"));
        url.searchParams.set("state", state);
        url.searchParams.set("scope", "openid profile email w_member_social");
        res.redirect(url.toString());
    } catch (error) {
        providerError("LinkedIn", error);
        redirect(res, "/accounts", { error: "LinkedIn connection failed." });
    }
});

socialRouter.get("/linkedin/callback", async (req, res) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    try {
        if (error || !code || !state) throw new Error("LinkedIn authorization was cancelled or incomplete.");
        const stateRecord = await consumeState(state, "linkedin");
        const token = await exchangeJson("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: requiredEnv("LINKEDIN_REDIRECT_URI"), client_id: requiredEnv("LINKEDIN_CLIENT_ID"), client_secret: requiredEnv("LINKEDIN_CLIENT_SECRET") }),
        });
        const profile = await exchangeJson("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${String(token.access_token)}` } });
        await saveAccount(stateRecord.userId.toString(), { platform: "linkedin", platformUserId: String(profile.sub), displayName: String(profile.name || "LinkedIn member"), profileImage: typeof profile.picture === "string" ? profile.picture : undefined, accessToken: String(token.access_token), refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : undefined, expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : undefined });
        redirect(res, "/accounts", { connected: "linkedin" });
    } catch (error) {
        providerError("LinkedIn", error);
        redirect(res, "/accounts", { error: "LinkedIn connection failed." });
    }
});

socialRouter.post("/:platform/disconnect", async (req, res, next) => {
    try {
        const platform = req.params.platform;
        if (!["instagram", "facebook", "linkedin"].includes(platform)) { res.status(400).json({ message: "Unsupported platform." }); return; }
        const accountId = typeof req.body.accountId === "string" ? req.body.accountId : "";
        await SocialAccount.deleteOne({ _id: accountId, userId: req.portalUser!._id, platform: platform as "instagram" | "facebook" | "linkedin" });
        res.status(204).end();
    } catch (error) { next(error); }
});
