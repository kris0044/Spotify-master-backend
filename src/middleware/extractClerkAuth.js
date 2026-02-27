import { clerkClient } from "@clerk/express";

// Custom middleware to extract and verify token from Authorization header
export const extractClerkAuth = async (req, res, next) => {
	try {
		// Get token from Authorization header
		const authHeader = req.headers.authorization;
		
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			console.log("⚠️ No Bearer token found in Authorization header");
			// Set empty auth object so routes can check authentication
			req.auth = { userId: null };
			return next();
		}

		const token = authHeader.substring(7); // Remove 'Bearer ' prefix
		
		console.log("🔍 Attempting to verify token...");
		
		// Verify the session token by fetching the session
		// The token from Clerk.getToken() is a session token (JWT)
		// We need to decode it to get the session ID, then verify the session
		const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
		const sessionId = decoded.sid;
		
		console.log("📝 Session ID from token:", sessionId);
		
		// Verify the session is valid
		const session = await clerkClient.sessions.getSession(sessionId);
		
		if (!session || session.status !== 'active') {
			console.log("❌ Session is not active");
			req.auth = { userId: null };
			return next();
		}
		
		console.log("✅ Token verified! User ID:", session.userId);
		
		// Set the auth object like clerkMiddleware would
		req.auth = {
			userId: session.userId,
			sessionId: session.id,
		};
		
		next();
	} catch (error) {
		console.error("❌ Token verification failed:", error.message);
		// Set empty auth object on error
		req.auth = { userId: null };
		next();
	}
};