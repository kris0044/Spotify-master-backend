export const protectRecommendations = (req, res, next) => {
	if (!req.auth?.userId) {
		return res.status(401).json({ message: "Unauthorized - you must be logged in" });
	}
	next();
};
