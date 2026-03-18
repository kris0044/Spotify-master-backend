import mongoose from "mongoose";
import { PlayHistory } from "../models/playHistory.model.js";
import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";

const APPROVED_SONG_FILTER = {
	$or: [{ isApproved: true }, { isApproved: { $exists: false } }, { isApproved: null }],
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getRecommendations = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const currentUser = await User.findOne({ clerkId: userId }).select("role");
		const isAdmin = currentUser?.role === "admin";
		const fromDate = new Date(Date.now() - THIRTY_DAYS_MS);

		const basePipeline = [
			{ $match: { userId, lastPlayedAt: { $gte: fromDate } } },
			{ $lookup: { from: "songs", localField: "songId", foreignField: "_id", as: "song" } },
			{ $unwind: "$song" },
			...(isAdmin ? [] : [{ $match: { "song.isApproved": { $ne: false } } }]),
		];

		const [topArtists, topGenres] = await Promise.all([
			PlayHistory.aggregate([
				...basePipeline,
				{ $match: { "song.artist": { $type: "string", $ne: "" } } },
				{ $group: { _id: "$song.artist", score: { $sum: "$playCount" } } },
				{ $sort: { score: -1 } },
				{ $limit: 5 },
			]),
			PlayHistory.aggregate([
				...basePipeline,
				{
					$project: {
						playCount: 1,
						genres: {
							$cond: [{ $isArray: "$song.genre" }, "$song.genre", ["$song.genre"]],
						},
					},
				},
				{ $unwind: "$genres" },
				{ $match: { genres: { $type: "string", $ne: "" } } },
				{ $group: { _id: "$genres", score: { $sum: "$playCount" } } },
				{ $sort: { score: -1 } },
				{ $limit: 5 },
			]),
		]);

		const artistSignals = topArtists.map((item) => item._id).filter(Boolean);
		const genreSignals = topGenres.map((item) => item._id).filter(Boolean);

		if (!artistSignals.length && !genreSignals.length) {
			return res.status(200).json({
				topArtists: [],
				topGenres: [],
				recommendations: [],
			});
		}

		const playedSongIds = await PlayHistory.distinct("songId", { userId });
		const normalizedPlayedSongIds = playedSongIds
			.filter((id) => mongoose.Types.ObjectId.isValid(id))
			.map((id) => new mongoose.Types.ObjectId(id));

		const recommendations = await Song.aggregate([
			{
				$match: {
					...(isAdmin ? {} : APPROVED_SONG_FILTER),
					...(normalizedPlayedSongIds.length
						? { _id: { $nin: normalizedPlayedSongIds } }
						: {}),
				},
			},
			{
				$addFields: {
					genreList: {
						$cond: [{ $isArray: "$genre" }, "$genre", ["$genre"]],
					},
				},
			},
			{
				$addFields: {
					artistScore: {
						$cond: [{ $in: ["$artist", artistSignals] }, 2, 0],
					},
					genreScore: {
						$size: {
							$setIntersection: [
								genreSignals,
								{
									$filter: {
										input: "$genreList",
										as: "genre",
										cond: { $and: [{ $ne: ["$$genre", null] }, { $ne: ["$$genre", ""] }] },
									},
								},
							],
						},
					},
				},
			},
			{
				$addFields: {
					matchScore: { $add: ["$artistScore", "$genreScore"] },
				},
			},
			{ $match: { matchScore: { $gt: 0 } } },
			{ $sort: { matchScore: -1, playCount: -1, createdAt: -1 } },
			{ $limit: 20 },
		]);

		res.status(200).json({
			topArtists: artistSignals,
			topGenres: genreSignals,
			recommendations,
		});
	} catch (error) {
		next(error);
	}
};
