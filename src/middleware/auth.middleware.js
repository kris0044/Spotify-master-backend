import { clerkClient } from "@clerk/express";

export const protectRoute = (req, res, next) => {
	// Clerk middleware should always set req.auth, even if user is not authenticated
	// If req.auth is undefined, Clerk middleware isn't working properly
	if (!req.auth) {
		console.error("protectRoute ERROR: req.auth is undefined - Clerk middleware may not be configured correctly");
		console.error("Request headers:", {
			authorization: req.headers.authorization ? "present" : "missing",
			host: req.headers.host,
			path: req.path,
		});
		return res
			.status(401)
			.json({ 
				message: "Unauthorized - you must be logged in. Please sign in.",
				error: "Authentication middleware error"
			});
	}

	// Check if user is authenticated
	if (!req.auth.userId) {
		console.log("protectRoute: User not authenticated", { 
			path: req.path,
			hasAuth: !!req.auth,
		});
		return res
			.status(401)
			.json({ 
				message: "Unauthorized - you must be logged in. Please sign in."
			});
	}

	// User is authenticated
	next();
};

export const requireAdmin = async (req, res, next) => {
	try {
		// First check if user is authenticated
		if (!req.auth?.userId) {
			return res
				.status(401)
				.json({ message: "Unauthorized - you must be logged in" });
		}

		// Try to get user from Clerk
		let isAdminByEmail = false;
		try {
			const clerkUser = await clerkClient.users.getUser(req.auth.userId);
			isAdminByEmail =
				clerkUser.primaryEmailAddress?.emailAddress === process.env.ADMIN_EMAIL;
		} catch (clerkError) {
			// If Clerk API fails, just continue to check database role
			console.log("Clerk API error:", clerkError.message);
		}

		// Also check database role
		const { User } = await import("../models/user.model.js");
		let dbUser = await User.findOne({ clerkId: req.auth.userId });

		// If user doesn't exist in database, create it
		if (!dbUser) {
			try {
				const clerkUser = await clerkClient.users.getUser(req.auth.userId);
				const isAdminEmail = clerkUser.primaryEmailAddress?.emailAddress === process.env.ADMIN_EMAIL;
				dbUser = await User.create({
					clerkId: req.auth.userId,
					fullName: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
					imageUrl: clerkUser.imageUrl || "",
					role: isAdminEmail ? "admin" : "user",
				});
			} catch (clerkError) {
				return res
					.status(403)
					.json({ message: "User not found. Please sign in again." });
			}
		}

		// Ensure user has a role
		if (!dbUser.role) {
			dbUser.role = isAdminByEmail ? "admin" : "user";
			await dbUser.save();
		}

		const isAdminByRole = dbUser.role === "admin";

		if (!isAdminByEmail && !isAdminByRole) {
			return res
				.status(403)
				.json({ message: "Unauthorized - admin only" });
		}

		next();
	} catch (error) {
		next(error);
	}
};

export const requireArtist = async (req, res, next) => {
	try {
		// First check if user is authenticated
		if (!req.auth?.userId) {
			return res
				.status(401)
				.json({ message: "Unauthorized - you must be logged in" });
		}

		const { User } = await import("../models/user.model.js");
		let user = await User.findOne({ clerkId: req.auth.userId });

		// If user doesn't exist in database, create it with default role
		if (!user) {
			// Try to get user info from Clerk
			try {
				const clerkUser = await clerkClient.users.getUser(req.auth.userId);
				user = await User.create({
					clerkId: req.auth.userId,
					fullName: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
					imageUrl: clerkUser.imageUrl || "",
					role: "user",
				});
			} catch (clerkError) {
				return res
					.status(403)
					.json({ message: "User not found. Please sign in again." });
			}
		}

		// Ensure user has a role
		if (!user.role) {
			user.role = "user";
			await user.save();
		}

		if (user.role !== "artist" && user.role !== "admin") {
			return res
				.status(403)
				.json({ message: "Unauthorized - artist or admin only" });
		}

		req.user = user;
		next();
	} catch (error) {
		next(error);
	}
};