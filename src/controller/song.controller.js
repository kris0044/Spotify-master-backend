import { Song } from "../models/song.model.js";

export const getAllSongs = async (req, res, next) => {
	try {
		// Only show approved songs to regular users
		// For backward compatibility: treat undefined/null isApproved as approved
		const filter = req.user?.role === "admin" 
			? {} 
			: { 
				$or: [
					{ isApproved: true },
					{ isApproved: { $exists: false } },
					{ isApproved: null }
				]
			};
		// -1 = Descending => newest -> oldest
		// 1 = Ascending => oldest -> newest
		const songs = await Song.find(filter).sort({ createdAt: -1 });
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
					{ isApproved: null }
				]
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
					{ isApproved: null }
				]
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
					{ isApproved: null }
				]
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
		const song = await Song.findByIdAndUpdate(
			id,
			{ $inc: { playCount: 1 } },
			{ new: true }
		);

		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		res.status(200).json({ playCount: song.playCount });
	} catch (error) {
		next(error);
	}
};
