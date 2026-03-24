import { verifyToken } from "@clerk/express";

const getRefererOrigin = (referer) => {
	try {
		return referer ? new URL(referer).origin : null;
	} catch {
		return null;
	}
};

const getAuthorizedParties = (req) => {
	const configured = (process.env.CLERK_AUTHORIZED_PARTIES || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

	const defaults = [
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"*",
		req.headers.origin,
		getRefererOrigin(req.headers.referer),
	].filter(Boolean);

	return [...new Set([...configured, ...defaults])];
};

export const extractClerkAuth = async (req, res, next) => {
	try {
		if (req.auth?.userId) {
			return next();
		}

		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return next();
		}

		const token = authHeader.slice(7).trim();
		const authorizedParties = getAuthorizedParties(req);

		const payload = await verifyToken(token, {
			secretKey: process.env.CLERK_SECRET_KEY,
			authorizedParties,
		});

		const userId = typeof payload?.sub === "string" ? payload.sub : null;
		const sessionId = typeof payload?.sid === "string" ? payload.sid : null;

		if (!userId) {
			return next();
		}

		req.auth = {
			userId,
			sessionId,
		};

		return next();
	} catch (error) {
		console.error("Token verification failed:", error?.message || error);
		return next();
	}
};
