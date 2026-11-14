import crypto from "node:crypto";

const getEncryptionKey = () => {
    const configured = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    if (!configured) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");
    return crypto.createHash("sha256").update(configured).digest();
};

export const encryptSecret = (value: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
};

export const decryptSecret = (value: string) => {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted secret.");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
};

export const createOAuthState = () => crypto.randomBytes(32).toString("hex");
export const hashOAuthState = (state: string) => crypto.createHash("sha256").update(state).digest("hex");
