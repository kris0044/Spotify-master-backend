import { User } from "../models/user.model.js";

export const authCallback = async (req, res, next) => {
	try {
		const { id, firstName, lastName, imageUrl } = req.body;

		if (!id) {
			return res.status(400).json({ message: "User ID is required" });
		}

		// check if user already exists
		let user = await User.findOne({ clerkId: id });

		if (!user) {
			// signup - create user with default role "user"
			user = await User.create({
				clerkId: id,
				fullName: `${firstName || ""} ${lastName || ""}`.trim() || "User",
				imageUrl: imageUrl || "",
				role: "user", // Explicitly set default role
			});
		} else {
			// Update user info if it exists but might be missing fields
			if (!user.role) {
				user.role = "user";
				await user.save();
			}
		}

		res.status(200).json({ success: true, user: { role: user.role } });
	} catch (error) {
		console.log("Error in auth callback", error);
		next(error);
	}
};
