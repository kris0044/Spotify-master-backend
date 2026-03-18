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
		if (!req.auth?.userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const { User } = await import("../models/user.model.js");
		const existingUser = await User.findOne({ clerkId: req.auth.userId });

		// Fast path: trust persisted admin role first.
		if (existingUser?.role === "admin") {
			return next();
		}

		let clerkUser = null;
		let isAdminByEmail = false;
		try {
			clerkUser = await clerkClient.users.getUser(req.auth.userId);
			isAdminByEmail = clerkUser.primaryEmailAddress?.emailAddress === process.env.ADMIN_EMAIL;
		} catch (clerkError) {
			console.log("Clerk API error:", clerkError.message);
		}

		if (isAdminByEmail) {
			if (!existingUser) {
				await User.create({
					clerkId: req.auth.userId,
					fullName: `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim() || "Admin",
					imageUrl: clerkUser?.imageUrl || "",
					role: "admin",
				});
			} else if (existingUser.role !== "admin") {
				existingUser.role = "admin";
				await existingUser.save();
			}
			return next();
		}

		return res.status(403).json({ message: "Unauthorized - admin only" });
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
