import { verifyToken } from "@clerk/express";

export const extractClerkAuth = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			req.auth = { userId: null };
			return next();
		}

		const token = authHeader.slice(7).trim();

		const payload = await verifyToken(token, {
			secretKey: process.env.CLERK_SECRET_KEY,
		});

		const userId = typeof payload?.sub === "string" ? payload.sub : null;
		const sessionId = typeof payload?.sid === "string" ? payload.sid : null;

		if (!userId) {
			req.auth = { userId: null };
			return next();
		}

		req.auth = {
			userId,
			sessionId,
		};

		return next();
	} catch (error) {
		console.error("Token verification failed:", error?.message || error);
		req.auth = { userId: null };
		return next();
	}
};
