import { Song } from "../models/song.model.js";
import { PlayHistory } from "../models/playHistory.model.js";
import { emitToUser } from "../lib/socket.js";

export const getAllSongs = async (req, res, next) => {
	try {
		const { genre, search, limit, offset } = req.query;
		// Only show approved songs to regular users
		// For backward compatibility: treat undefined/null isApproved as approved
		const filter = req.user?.role === "admin"
			? {}
			: {
				$or: [
					{ isApproved: true },
					{ isApproved: { $exists: false } },
					{ isApproved: null },
				],
			};

		if (genre) {
			filter.genre = { $regex: `^${String(genre).trim()}$`, $options: "i" };
		}

		if (search) {
			filter.$and = [
				...(filter.$and || []),
				{
					$or: [
						{ title: { $regex: String(search).trim(), $options: "i" } },
						{ artist: { $regex: String(search).trim(), $options: "i" } },
						{ genre: { $regex: String(search).trim(), $options: "i" } },
					],
				},
			];
		}
		// -1 = Descending => newest -> oldest
		// 1 = Ascending => oldest -> newest
		const songsQuery = Song.find(filter).sort({ createdAt: -1 });
		if (limit !== undefined) {
			songsQuery.limit(Math.max(Number(limit) || 0, 0));
		}
		if (offset !== undefined) {
			songsQuery.skip(Math.max(Number(offset) || 0, 0));
		}

		const songs = await songsQuery;
		res.json(songs);
	} catch (error) {
		next(error);
	}
};

export const getFeaturedSongs = async (req, res, next) => {
	try {
		// Only show approved songs to regular users
		// For backward compatibility: treat undefined/null isApproved as approved
		const filter = req.user?.role === "admin"
			? {}
			: {
				$or: [
					{ isApproved: true },
					{ isApproved: { $exists: false } },
					{ isApproved: null },
				],
			};
		// fetch 6 random songs using mongodb's aggregation pipeline
		const songs = await Song.aggregate([
			{
				$match: filter,
			},
			{
				$sample: { size: 6 },
			},
			{
				$project: {
					_id: 1,
					title: 1,
					artist: 1,
					genre: 1,
					imageUrl: 1,
					audioUrl: 1,
				},
			},
		]);

		res.json(songs);
	} catch (error) {
		next(error);
	}
};

export const getMadeForYouSongs = async (req, res, next) => {
	try {
		// Only show approved songs to regular users
		// For backward compatibility: treat undefined/null isApproved as approved
		const filter = req.user?.role === "admin"
			? {}
			: {
				$or: [
					{ isApproved: true },
					{ isApproved: { $exists: false } },
					{ isApproved: null },
				],
			};
		const songs = await Song.aggregate([
			{
				$match: filter,
			},
			{
				$sample: { size: 4 },
			},
			{
				$project: {
					_id: 1,
					title: 1,
					artist: 1,
					genre: 1,
					imageUrl: 1,
					audioUrl: 1,
				},
			},
		]);

		res.json(songs);
	} catch (error) {
		next(error);
	}
};

export const getTrendingSongs = async (req, res, next) => {
	try {
		// Only show approved songs to regular users
		// For backward compatibility: treat undefined/null isApproved as approved
		const filter = req.user?.role === "admin"
			? {}
			: {
				$or: [
					{ isApproved: true },
					{ isApproved: { $exists: false } },
					{ isApproved: null },
				],
			};
		// Get songs sorted by playCount (most played first)
		const songs = await Song.aggregate([
			{
				$match: filter,
			},
			{
				$sort: { playCount: -1 },
			},
			{
				$limit: 4,
			},
			{
				$project: {
					_id: 1,
					title: 1,
					artist: 1,
					genre: 1,
					imageUrl: 1,
					audioUrl: 1,
					playCount: 1,
				},
			},
		]);

		res.json(songs);
	} catch (error) {
		next(error);
	}
};

export const incrementPlayCount = async (req, res, next) => {
	try {
		const { id } = req.params;
		const song = await Song.findByIdAndUpdate(id, { $inc: { playCount: 1 } }, { new: true });

		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		let userPlayCount = null;
		if (req.auth?.userId) {
			try {
				const history = await PlayHistory.findOneAndUpdate(
					{ userId: req.auth.userId, songId: id },
					{ $inc: { playCount: 1 }, $set: { lastPlayedAt: new Date() } },
					{ upsert: true, new: true, setDefaultsOnInsert: true }
				);

				userPlayCount = history.playCount;
				emitToUser(req.auth.userId, "history_updated", {
					songId: id,
					playCount: history.playCount,
					lastPlayedAt: history.lastPlayedAt,
				});
			} catch (historyError) {
				console.error("Failed to track user history:", historyError.message);
			}
		}

		res.status(200).json({ playCount: song.playCount, userPlayCount });
	} catch (error) {
		next(error);
	}
};
