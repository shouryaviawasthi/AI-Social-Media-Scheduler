import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import PortalUser from "../models/PortalUser.js";
import Post from "../models/Post.js";
import Activity from "../models/Activity.js";

type LocalUser = {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: string;
};

type LocalPost = {
    _id: string;
    userId: string;
    content: string;
    platforms: string[];
    scheduledFor?: string;
    status: "scheduled" | "published";
    mediaType?: string;
    mediaUrl?: string;
    createdAt: string;
    updatedAt: string;
};

type LocalActivity = {
    _id: string;
    userId: string;
    actionType: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    relatedPost?: { _id: string; content: string } | null;
};

type LocalState = {
    accounts?: unknown[];
    posts?: LocalPost[];
    activities?: LocalActivity[];
};

type ExportData = {
    scheduler_users?: LocalUser[];
    [key: string]: unknown;
};

const inputPath = process.argv[2];
if (!inputPath) {
    throw new Error("Usage: npm run migrate:local -- path/to/scheduler-local-data.json");
}

const isValidDate = (value: string | undefined) => !value || !Number.isNaN(new Date(value).getTime());
const asState = (value: unknown): LocalState => value && typeof value === "object" ? value as LocalState : {};

const main = async () => {
    const raw = await fs.readFile(path.resolve(inputPath), "utf8");
    const exported = JSON.parse(raw) as ExportData;
    const users = Array.isArray(exported.scheduler_users) ? exported.scheduler_users : [];
    const userMap = new Map<string, string>();
    let usersMigrated = 0;
    let usersSkipped = 0;
    let postsFound = 0;
    let postsMigrated = 0;
    let postDuplicatesSkipped = 0;
    let activitiesFound = 0;
    let activitiesMigrated = 0;
    let activityDuplicatesSkipped = 0;
    let fakeAccountsSkipped = 0;

    await connectDB();

    for (const localUser of users) {
        if (!localUser?.id || !localUser.email || !localUser.name || typeof localUser.password !== "string") {
            usersSkipped += 1;
            continue;
        }
        if (!isValidDate(localUser.createdAt)) {
            usersSkipped += 1;
            continue;
        }

        const email = localUser.email.trim().toLowerCase();
        let user = await PortalUser.findOne({ $or: [{ legacyId: localUser.id }, { email }] });
        if (!user) {
            user = await PortalUser.create({
                legacyId: localUser.id,
                name: localUser.name.trim(),
                email,
                passwordHash: await bcrypt.hash(localUser.password, 12),
                createdAt: new Date(localUser.createdAt),
                updatedAt: new Date(localUser.createdAt),
            });
            usersMigrated += 1;
        } else {
            if (!user.legacyId) user.legacyId = localUser.id;
            user.name = localUser.name.trim();
            user.email = email;
            if (!(await bcrypt.compare(localUser.password, user.passwordHash))) {
                user.passwordHash = await bcrypt.hash(localUser.password, 12);
            }
            await user.save();
            usersSkipped += 1;
        }
        userMap.set(localUser.id, user._id.toString());
    }

    for (const [key, rawState] of Object.entries(exported)) {
        if (!key.startsWith("scheduler_data_")) continue;
        const oldUserId = key.slice("scheduler_data_".length);
        const mongoUserId = userMap.get(oldUserId);
        const state = asState(rawState);
        fakeAccountsSkipped += Array.isArray(state.accounts) ? state.accounts.length : 0;
        if (!mongoUserId) continue;

        for (const localPost of state.posts || []) {
            postsFound += 1;
            if (!localPost._id || !localPost.content || !Array.isArray(localPost.platforms) || !isValidDate(localPost.scheduledFor) || !isValidDate(localPost.createdAt) || !isValidDate(localPost.updatedAt)) continue;
            const existing = await Post.findOne({ legacyId: localPost._id });
            if (existing) {
                postDuplicatesSkipped += 1;
                continue;
            }
            await Post.create({
                userId: mongoUserId,
                legacyId: localPost._id,
                content: localPost.content,
                platforms: localPost.platforms,
                scheduledFor: localPost.scheduledFor ? new Date(localPost.scheduledFor) : undefined,
                status: localPost.status === "published" ? "published" : "scheduled",
                mediaType: localPost.mediaType,
                mediaUrl: localPost.mediaUrl,
                createdAt: new Date(localPost.createdAt),
                updatedAt: new Date(localPost.updatedAt),
            });
            postsMigrated += 1;
        }

        for (const localActivity of state.activities || []) {
            activitiesFound += 1;
            if (!localActivity._id || !localActivity.actionType || !localActivity.description || !isValidDate(localActivity.createdAt) || !isValidDate(localActivity.updatedAt)) continue;
            const existing = await Activity.findOne({ legacyId: localActivity._id });
            if (existing) {
                activityDuplicatesSkipped += 1;
                continue;
            }
            await Activity.create({
                userId: mongoUserId,
                legacyId: localActivity._id,
                actionType: localActivity.actionType,
                description: localActivity.description,
                relatedPost: localActivity.relatedPost || null,
                createdAt: new Date(localActivity.createdAt),
                updatedAt: new Date(localActivity.updatedAt),
            });
            activitiesMigrated += 1;
        }
    }

    console.log("================================");
    console.log("MIGRATION SUMMARY");
    console.log("================================");
    console.log(`Users found: ${users.length}`);
    console.log(`Users migrated: ${usersMigrated}`);
    console.log(`Users already present/skipped: ${usersSkipped}`);
    console.log("");
    console.log(`Posts found: ${postsFound}`);
    console.log(`Posts migrated: ${postsMigrated}`);
    console.log(`Post duplicates skipped: ${postDuplicatesSkipped}`);
    console.log("");
    console.log(`Activities found: ${activitiesFound}`);
    console.log(`Activities migrated: ${activitiesMigrated}`);
    console.log(`Activity duplicates skipped: ${activityDuplicatesSkipped}`);
    console.log("");
    console.log(`Fake social accounts skipped: ${fakeAccountsSkipped}`);
    console.log("");
    console.log("Migration completed successfully.");
    console.log("================================");
    process.exit(0);
};

main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
