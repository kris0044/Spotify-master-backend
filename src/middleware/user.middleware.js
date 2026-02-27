import { User } from "../models/user.model.js";

export const populateUser = async (req, res, next) => {
	try {
		if (req.auth?.userId) {
			const user = await User.findOne({ clerkId: req.auth.userId });
			req.user = user || null;
		}
		next();
	} catch (error) {
		next(error);
	}
};

