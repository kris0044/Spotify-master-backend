import { PlayHistory } from "../models/playHistory.model.js";
import { User } from "../models/user.model.js";

const APPROVED_SONG_FILTER = {
	$or: [{ "song.isApproved": true }, { "song.isApproved": { $exists: false } }, { "song.isApproved": null }],
};

export const getRecentlyPlayed = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const user = await User.findOne({ clerkId: userId }).select("role");
		const songVisibilityMatch = user?.role === "admin" ? {} : APPROVED_SONG_FILTER;

		const recentHistory = await PlayHistory.aggregate([
			{ $match: { userId } },
			{ $sort: { lastPlayedAt: -1 } },
			{ $limit: 50 },
			{ $lookup: { from: "songs", localField: "songId", foreignField: "_id", as: "song" } },
			{ $unwind: "$song" },
			{ $match: songVisibilityMatch },
			{
				$project: {
					_id: 1,
					playCount: 1,
					lastPlayedAt: 1,
					song: {
						_id: "$song._id",
						title: "$song.title",
						artist: "$song.artist",
						albumId: "$song.albumId",
						imageUrl: "$song.imageUrl",
						audioUrl: "$song.audioUrl",
						duration: "$song.duration",
						playCount: "$song.playCount",
						createdAt: "$song.createdAt",
						updatedAt: "$song.updatedAt",
					},
				},
			},
		]);

		res.status(200).json(recentHistory);
	} catch (error) {
		next(error);
	}
};

export const getTopPlayedSongs = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const user = await User.findOne({ clerkId: userId }).select("role");
		const songVisibilityMatch = user?.role === "admin" ? {} : APPROVED_SONG_FILTER;

		const topPlayedSongs = await PlayHistory.aggregate([
			{ $match: { userId } },
			{ $sort: { playCount: -1, lastPlayedAt: -1 } },
			{ $limit: 20 },
			{ $lookup: { from: "songs", localField: "songId", foreignField: "_id", as: "song" } },
			{ $unwind: "$song" },
			{ $match: songVisibilityMatch },
			{
				$project: {
					_id: 1,
					playCount: 1,
					lastPlayedAt: 1,
					song: {
						_id: "$song._id",
						title: "$song.title",
						artist: "$song.artist",
						albumId: "$song.albumId",
						imageUrl: "$song.imageUrl",
						audioUrl: "$song.audioUrl",
						duration: "$song.duration",
						playCount: "$song.playCount",
						createdAt: "$song.createdAt",
						updatedAt: "$song.updatedAt",
					},
				},
			},
		]);

		res.status(200).json(topPlayedSongs);
	} catch (error) {
		next(error);
	}
};

export const getHistoryStats = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const stats = await PlayHistory.aggregate([
			{ $match: { userId } },
			{
				$group: {
					_id: null,
					totalPlays: { $sum: "$playCount" },
					uniqueSongs: { $sum: 1 },
					lastPlayedAt: { $max: "$lastPlayedAt" },
				},
			},
		]);

		const fallback = { totalPlays: 0, uniqueSongs: 0, lastPlayedAt: null };
		res.status(200).json(stats[0] || fallback);
	} catch (error) {
		next(error);
	}
};
