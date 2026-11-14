import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import PortalUser, { type PortalUserDocument } from "./models/PortalUser.js";
import Session from "./models/Session.js";

const SESSION_COOKIE = "scheduler_session";
const SESSION_DAYS = 7;

declare global {
    namespace Express {
        interface Request {
            portalUser?: PortalUserDocument;
        }
    }
}

const hashToken = (token: string) =>
    crypto.createHash("sha256").update(token).digest("hex");

const cookieOptions = [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
].join("; ");

const setSessionCookie = (res: Response, token: string) => {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${token}; ${cookieOptions}; Max-Age=${SESSION_DAYS * 86400}`
    );
};

const clearSessionCookie = (res: Response) => {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; ${cookieOptions}; Max-Age=0`
    );
};

const getCookie = (request: Request, name: string) => {
    const header = request.headers.cookie;

    if (!header) return undefined;

    return header
        .split(";")
        .map((value) => value.trim())
        .find((value) => value.startsWith(`${name}=`))
        ?.slice(name.length + 1);
};

const publicUser = (user: PortalUserDocument) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
});

export const requirePortalUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = getCookie(req, SESSION_COOKIE);

        if (!token) {
            res.status(401).json({
                message: "You must be signed in.",
            });
            return;
        }

        const session = await Session.findOne({
            tokenHash: hashToken(token),
            expiresAt: { $gt: new Date() },
        });

        if (!session) {
            clearSessionCookie(res);

            res.status(401).json({
                message: "Your session has expired.",
            });

            return;
        }

        const user = await PortalUser.findById(session.userId);

        if (!user) {
            clearSessionCookie(res);

            res.status(401).json({
                message: "Your session is invalid.",
            });

            return;
        }

        req.portalUser = user;
        next();
    } catch (error) {
        next(error);
    }
};

const createSession = async (
    user: PortalUserDocument,
    res: Response
) => {
    const token = crypto.randomBytes(32).toString("hex");

    await Session.create({
        tokenHash: hashToken(token),
        userId: user._id,
        expiresAt: new Date(
            Date.now() + SESSION_DAYS * 86400000
        ),
    });

    setSessionCookie(res, token);
};

const validateCredentials = (
    email: unknown,
    password: unknown,
    requireStrongPassword = true
) => {
    if (
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password.length ||
        (requireStrongPassword && password.length < 8)
    ) {
        return "Enter a valid email and a password with at least 8 characters.";
    }

    return undefined;
};

export const authRouter = Router();

authRouter.post("/signup", async (req, res, next) => {
    try {
        const {
            name,
            email,
            password,
        } = req.body as {
            name?: string;
            email?: string;
            password?: string;
        };

        const validationError = validateCredentials(
            email,
            password
        );

        if (validationError || !name?.trim()) {
            res.status(400).json({
                message:
                    validationError ||
                    "Name is required.",
            });

            return;
        }

        const normalizedEmail = email!
            .trim()
            .toLowerCase();

        if (
            await PortalUser.exists({
                email: normalizedEmail,
            })
        ) {
            res.status(409).json({
                message:
                    "An account with this email already exists.",
            });

            return;
        }

        const user = await PortalUser.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(
                password!,
                12
            ),
        });

        await createSession(user, res);

        res.status(201).json({
            user: publicUser(user),
        });
    } catch (error) {
        next(error);
    }
});

authRouter.post("/login", async (req, res, next) => {
    try {
        const {
            email,
            password,
        } = req.body as {
            email?: string;
            password?: string;
        };

        const validationError = validateCredentials(
            email,
            password,
            false
        );

        if (validationError) {
            res.status(400).json({
                message: validationError,
            });

            return;
        }

        const user = await PortalUser.findOne({
            email: email!.trim().toLowerCase(),
        });

        if (
            !user ||
            !(await bcrypt.compare(
                password!,
                user.passwordHash
            ))
        ) {
            res.status(401).json({
                message: "Invalid email or password.",
            });

            return;
        }

        await createSession(user, res);

        res.json({
            user: publicUser(user),
        });
    } catch (error) {
        next(error);
    }
});

authRouter.post(
    "/logout",
    requirePortalUser,
    async (req, res, next) => {
        try {
            const token = getCookie(
                req,
                SESSION_COOKIE
            );

            if (token) {
                await Session.deleteOne({
                    tokenHash: hashToken(token),
                });
            }

            clearSessionCookie(res);

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    }
);

authRouter.get(
    "/me",
    requirePortalUser,
    (req, res) => {
        res.json({
            user: publicUser(
                req.portalUser!
            ),
        });
    }
);