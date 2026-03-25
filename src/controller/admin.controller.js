import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { PlayHistory } from "../models/playHistory.model.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Favorite } from "../models/favorite.model.js";
import { Feedback } from "../models/feedback.model.js";
import cloudinary from "../lib/cloudinary.js";
import {
	notifyNewsletterSubscribersAboutAlbum,
	notifyNewsletterSubscribersAboutSong,
} from "../lib/notifications.js";

const ANALYTICS_RANGE_CONFIG = {
	week: { days: 7, bucketFormat: "%d %b", keyFormat: "%Y-%m-%d", bucketUnit: "day" },
	month: { days: 30, bucketFormat: "%d %b", keyFormat: "%Y-%m-%d", bucketUnit: "day" },
	year: { months: 12, bucketFormat: "%b", keyFormat: "%Y-%m", bucketUnit: "month" },
};

const getAnalyticsWindow = (range = "month") => {
	const normalizedRange = Object.hasOwn(ANALYTICS_RANGE_CONFIG, range) ? range : "month";
	const now = new Date();
	const endDate = new Date(now);
	const startDate = new Date(now);
	const { days, months } = ANALYTICS_RANGE_CONFIG[normalizedRange];

	if (typeof days === "number") {
		startDate.setDate(startDate.getDate() - (days - 1));
		startDate.setHours(0, 0, 0, 0);
	} else if (typeof months === "number") {
		startDate.setMonth(startDate.getMonth() - (months - 1), 1);
		startDate.setHours(0, 0, 0, 0);
	}

	endDate.setHours(23, 59, 59, 999);

	return {
		range: normalizedRange,
		startDate,
		endDate,
		config: ANALYTICS_RANGE_CONFIG[normalizedRange],
	};
};

const buildTimeBuckets = (startDate, range) => {
	const buckets = [];
	const cursor = new Date(startDate);

	if (range === "year") {
		for (let index = 0; index < 12; index += 1) {
			buckets.push({
				key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
				label: cursor.toLocaleDateString("en-US", { month: "short" }),
				value: 0,
			});
			cursor.setMonth(cursor.getMonth() + 1, 1);
		}
		return buckets;
	}

	const totalDays = range === "week" ? 7 : 30;
	for (let index = 0; index < totalDays; index += 1) {
		buckets.push({
			key: cursor.toISOString().slice(0, 10),
			label: cursor.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
			value: 0,
		});
		cursor.setDate(cursor.getDate() + 1);
	}

	return buckets;
};

// helper function for cloudinary uploads
const uploadToCloudinary = async (file) => {
  try {
    console.log("Cloudinary ENV at upload:", {
      cloud: process.env.CLOUDINARY_CLOUD_NAME,
      key: !!process.env.CLOUDINARY_API_KEY,
      secret: !!process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto",
    });

    return result.secure_url;
  } catch (error) {
    console.log("Error in uploadToCloudinary", error);
    throw new Error("Error uploading to cloudinary");
  }
};


export const createSong = async (req, res, next) => {
	try {
		if (!req.files || !req.files.audioFile || !req.files.imageFile) {
			return res.status(400).json({ message: "Please upload all files" });
		}

		const { title, artist, genre, albumId, duration } = req.body;
		const audioFile = req.files.audioFile;
		const imageFile = req.files.imageFile;

		const audioUrl = await uploadToCloudinary(audioFile);
		const imageUrl = await uploadToCloudinary(imageFile);

		const song = new Song({
			title,
			artist,
			genre: genre?.trim() || null,
			audioUrl,
			imageUrl,
			duration,
			albumId: albumId || null,
			isApproved: true, // Admin-created songs are auto-approved
		});

		await song.save();

		// if song belongs to an album, update the album's songs array
		if (albumId) {
			await Album.findByIdAndUpdate(albumId, {
				$push: { songs: song._id },
			});
		}

		await notifyNewsletterSubscribersAboutSong(song);
		res.status(201).json(song);
	} catch (error) {
		console.log("Error in createSong", error);
		next(error);
	}
};

export const deleteSong = async (req, res, next) => {
	try {
		const { id } = req.params;

		const song = await Song.findById(id);

		// if song belongs to an album, update the album's songs array
		if (song.albumId) {
			await Album.findByIdAndUpdate(song.albumId, {
				$pull: { songs: song._id },
			});
		}

		await Song.findByIdAndDelete(id);

		res.status(200).json({ message: "Song deleted successfully" });
	} catch (error) {
		console.log("Error in deleteSong", error);
		next(error);
	}
};

export const createAlbum = async (req, res, next) => {
	try {
		const { title, artist, genre, releaseYear } = req.body;
		const { imageFile } = req.files;

		if (!imageFile) {
			return res.status(400).json({ message: "Album artwork is required" });
		}

		const imageUrl = await uploadToCloudinary(imageFile);
		const parsedSongs = req.body.songs ? JSON.parse(req.body.songs) : [];

		const album = new Album({
			title,
			artist,
			genre: genre?.trim() || null,
			imageUrl,
			releaseYear,
			isApproved: true, // Admin-created albums are auto-approved
		});

		await album.save();

		const createdSongs = [];

		for (let index = 0; index < parsedSongs.length; index += 1) {
			const songInput = parsedSongs[index];
			const audioFile = req.files?.[`audioFile_${index}`];
			const songImageFile = req.files?.[`imageFile_${index}`] || imageFile;

			if (!audioFile) {
				continue;
			}

			const audioUrl = await uploadToCloudinary(audioFile);
			const songImageUrl = await uploadToCloudinary(songImageFile);

			const song = await Song.create({
				title: songInput.title,
				artist: songInput.artist || artist,
				genre: songInput.genre?.trim() || genre?.trim() || null,
				audioUrl,
				imageUrl: songImageUrl,
				duration: Number(songInput.duration) || 0,
				albumId: album._id,
				isApproved: true,
			});

			createdSongs.push(song._id);
		}

		if (createdSongs.length) {
			album.songs = createdSongs;
			await album.save();
		}

		await notifyNewsletterSubscribersAboutAlbum(album, createdSongs.length);

		const populatedAlbum = await Album.findById(album._id).populate("songs");
		res.status(201).json(populatedAlbum);
	} catch (error) {
		console.log("Error in createAlbum", error);
		next(error);
	}
};

export const deleteAlbum = async (req, res, next) => {
	try {
		const { id } = req.params;
		await Song.deleteMany({ albumId: id });
		await Album.findByIdAndDelete(id);
		res.status(200).json({ message: "Album deleted successfully" });
	} catch (error) {
		console.log("Error in deleteAlbum", error);
		next(error);
	}
};

export const approveAllExistingSongs = async (req, res, next) => {
	try {
		// Approve all songs that don't have isApproved set or have it as false
		const result = await Song.updateMany(
			{
				$or: [
					{ isApproved: { $exists: false } },
					{ isApproved: false },
					{ isApproved: null }
				]
			},
			{
				$set: { isApproved: true }
			}
		);

		res.status(200).json({ 
			message: `Approved ${result.modifiedCount} existing songs`,
			modifiedCount: result.modifiedCount
		});
	} catch (error) {
		next(error);
	}
};

export const checkAdmin = async (req, res, next) => {
	try {
		if (!req.auth || !req.auth.userId) {
			return res.status(200).json({ admin: false });
		}

		let isAdminByEmail = false;
		let clerkUser = null;

		try {
			const { clerkClient } = await import("@clerk/express");
			clerkUser = await clerkClient.users.getUser(req.auth.userId);
			const userEmail = clerkUser.primaryEmailAddress?.emailAddress;
			isAdminByEmail = userEmail === process.env.ADMIN_EMAIL;
		} catch (clerkError) {
			console.error("Clerk API error:", clerkError.message);
		}

		const { User } = await import("../models/user.model.js");
		let dbUser = await User.findOne({ clerkId: req.auth.userId });

		if (isAdminByEmail && dbUser?.role !== "admin") {
			if (!dbUser) {
				dbUser = await User.create({
					clerkId: req.auth.userId,
					fullName: `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim() || "Admin",
					imageUrl: clerkUser?.imageUrl || "",
					role: "admin",
				});
			} else {
				dbUser.role = "admin";
				await dbUser.save();
			}
		}

		return res.status(200).json({ admin: isAdminByEmail || dbUser?.role === "admin" });
	} catch (error) {
		next(error);
	}
};

export const updateSong = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { title, artist, genre, duration, albumId } = req.body;
		const updateData = {};
		const existingSong = await Song.findById(id);

		if (!existingSong) {
			return res.status(404).json({ message: "Song not found" });
		}

		if (title) updateData.title = title;
		if (artist) updateData.artist = artist;
		if (genre !== undefined) updateData.genre = genre?.trim() || null;
		if (duration) updateData.duration = duration;
		if (albumId !== undefined) updateData.albumId = albumId || null;

		// Handle image update if provided
		if (req.files?.imageFile) {
			updateData.imageUrl = await uploadToCloudinary(req.files.imageFile);
		}

		const song = await Song.findByIdAndUpdate(id, updateData, { new: true });

		if (albumId !== undefined && existingSong.albumId?.toString() !== (albumId || "")) {
			if (existingSong.albumId) {
				await Album.findByIdAndUpdate(existingSong.albumId, { $pull: { songs: existingSong._id } });
			}

			if (albumId) {
				await Album.findByIdAndUpdate(albumId, { $addToSet: { songs: existingSong._id } });
			}
		}

		res.status(200).json(song);
	} catch (error) {
		console.log("Error in updateSong", error);
		next(error);
	}
};

export const updateAlbum = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { title, artist, genre, releaseYear } = req.body;
		const updateData = {};

		if (title) updateData.title = title;
		if (artist) updateData.artist = artist;
		if (genre !== undefined) updateData.genre = genre?.trim() || null;
		if (releaseYear) updateData.releaseYear = releaseYear;

		// Handle image update if provided
		if (req.files?.imageFile) {
			updateData.imageUrl = await uploadToCloudinary(req.files.imageFile);
		}

		const album = await Album.findByIdAndUpdate(id, updateData, { new: true });

		if (!album) {
			return res.status(404).json({ message: "Album not found" });
		}

		res.status(200).json(album);
	} catch (error) {
		console.log("Error in updateAlbum", error);
		next(error);
	}
};

export const approveSong = async (req, res, next) => {
	try {
		const { id } = req.params;
		const song = await Song.findByIdAndUpdate(
			id,
			{ isApproved: true },
			{ new: true }
		);

		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		res.status(200).json(song);
	} catch (error) {
		next(error);
	}
};

export const rejectSong = async (req, res, next) => {
	try {
		const { id } = req.params;
		const song = await Song.findByIdAndUpdate(
			id,
			{ isApproved: false },
			{ new: true }
		);

		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		res.status(200).json(song);
	} catch (error) {
		next(error);
	}
};

export const approveAlbum = async (req, res, next) => {
	try {
		const { id } = req.params;
		const album = await Album.findByIdAndUpdate(
			id,
			{ isApproved: true },
			{ new: true }
		);

		if (!album) {
			return res.status(404).json({ message: "Album not found" });
		}

		// Also approve all songs in the album
		await Song.updateMany({ albumId: id }, { isApproved: true });

		res.status(200).json(album);
	} catch (error) {
		next(error);
	}
};

export const rejectAlbum = async (req, res, next) => {
	try {
		const { id } = req.params;
		const album = await Album.findByIdAndUpdate(
			id,
			{ isApproved: false },
			{ new: true }
		);

		if (!album) {
			return res.status(404).json({ message: "Album not found" });
		}

		res.status(200).json(album);
	} catch (error) {
		next(error);
	}
};

export const getPendingSongs = async (req, res, next) => {
	try {
		const songs = await Song.find({ isApproved: false })
			.populate("uploadedBy", "fullName")
			.sort({ createdAt: -1 });
		res.status(200).json(songs);
	} catch (error) {
		next(error);
	}
};

export const getPendingAlbums = async (req, res, next) => {
	try {
		const albums = await Album.find({ isApproved: false })
			.populate("uploadedBy", "fullName")
			.sort({ createdAt: -1 });
		res.status(200).json(albums);
	} catch (error) {
		next(error);
	}
};

export const getDashboardAnalytics = async (req, res, next) => {
	try {
		const { range, startDate, endDate, config } = getAnalyticsWindow(req.query.range);
		const dateMatch = { lastPlayedAt: { $gte: startDate, $lte: endDate } };
		const bucketExpression =
			range === "year"
				? { $dateToString: { format: config.keyFormat, date: "$lastPlayedAt" } }
				: { $dateToString: { format: "%Y-%m-%d", date: "$lastPlayedAt" } };

		const [summary, topArtists, topListeners, topSongs, playsByPeriod, newSongs, newAlbums, pendingSongs, pendingAlbums] =
			await Promise.all([
				PlayHistory.aggregate([
					{ $match: dateMatch },
					{
						$group: {
							_id: null,
							totalStreams: { $sum: "$playCount" },
							activeListeners: { $addToSet: "$userId" },
						},
					},
					{
						$project: {
							_id: 0,
							totalStreams: 1,
							activeListeners: { $size: "$activeListeners" },
						},
					},
				]),
				PlayHistory.aggregate([
					{ $match: dateMatch },
					{ $lookup: { from: "songs", localField: "songId", foreignField: "_id", as: "song" } },
					{ $unwind: "$song" },
					{
						$group: {
							_id: "$song.artist",
							streams: { $sum: "$playCount" },
							songs: { $addToSet: "$song._id" },
						},
					},
					{ $sort: { streams: -1, _id: 1 } },
					{ $limit: 5 },
					{
						$project: {
							_id: 0,
							name: "$_id",
							streams: 1,
							songCount: { $size: "$songs" },
						},
					},
				]),
				PlayHistory.aggregate([
					{ $match: dateMatch },
					{
						$group: {
							_id: "$userId",
							streams: { $sum: "$playCount" },
							uniqueSongs: { $addToSet: "$songId" },
							lastPlayedAt: { $max: "$lastPlayedAt" },
						},
					},
					{ $sort: { streams: -1, lastPlayedAt: -1 } },
					{ $limit: 5 },
					{
						$lookup: {
							from: "users",
							localField: "_id",
							foreignField: "clerkId",
							as: "user",
						},
					},
					{
						$project: {
							_id: 0,
							clerkId: "$_id",
							streams: 1,
							uniqueSongs: { $size: "$uniqueSongs" },
							lastPlayedAt: 1,
							user: { $arrayElemAt: ["$user", 0] },
						},
					},
					{
						$project: {
							streams: 1,
							uniqueSongs: 1,
							lastPlayedAt: 1,
							name: { $ifNull: ["$user.fullName", "Unknown listener"] },
							imageUrl: "$user.imageUrl",
						},
					},
				]),
				PlayHistory.aggregate([
					{ $match: dateMatch },
					{
						$group: {
							_id: "$songId",
							streams: { $sum: "$playCount" },
							listeners: { $addToSet: "$userId" },
							lastPlayedAt: { $max: "$lastPlayedAt" },
						},
					},
					{ $sort: { streams: -1, lastPlayedAt: -1 } },
					{ $limit: 5 },
					{
						$lookup: {
							from: "songs",
							localField: "_id",
							foreignField: "_id",
							as: "song",
						},
					},
					{ $unwind: "$song" },
					{
						$project: {
							_id: 0,
							streams: 1,
							listeners: { $size: "$listeners" },
							lastPlayedAt: 1,
							title: "$song.title",
							artist: "$song.artist",
							imageUrl: "$song.imageUrl",
						},
					},
				]),
				PlayHistory.aggregate([
					{ $match: dateMatch },
					{
						$group: {
							_id: bucketExpression,
							value: { $sum: "$playCount" },
						},
					},
					{ $sort: { _id: 1 } },
				]),
				Song.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
				Album.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
				Song.countDocuments({ isApproved: false }),
				Album.countDocuments({ isApproved: false }),
			]);

		const chart = buildTimeBuckets(startDate, range);
		const chartMap = new Map(playsByPeriod.map((item) => [item._id, item.value]));
		const populatedChart = chart.map((item) => ({
			...item,
			value: chartMap.get(item.key) || 0,
		}));

		res.status(200).json({
			range,
			window: {
				startDate,
				endDate,
			},
			overview: {
				totalStreams: summary[0]?.totalStreams || 0,
				activeListeners: summary[0]?.activeListeners || 0,
				newSongs,
				newAlbums,
				pendingSongs,
				pendingAlbums,
			},
			bestSong: topSongs[0] || null,
			topSongs,
			topArtists,
			topListeners,
			playsTimeline: populatedChart.map(({ label, value }) => ({ label, value })),
		});
	} catch (error) {
		next(error);
	}
};

export const getUserInsights = async (req, res, next) => {
	try {
		const [overviewAggregation, rawPlaylists, topFavoritedSongs] = await Promise.all([
			Promise.all([
				Playlist.countDocuments(),
				Playlist.distinct("userId"),
				Favorite.countDocuments(),
				Favorite.distinct("songId"),
				Playlist.aggregate([
					{
						$group: {
							_id: null,
							totalSongs: { $sum: { $size: "$songs" } },
							playlistCount: { $sum: 1 },
						},
					},
				]),
			]),
			Playlist.find()
				.populate("songs", "title artist imageUrl duration genre")
				.sort({ updatedAt: -1 })
				.limit(100)
				.lean(),
			Favorite.aggregate([
				{
					$group: {
						_id: "$songId",
						favoritesCount: { $sum: 1 },
						lastFavoritedAt: { $max: "$createdAt" },
					},
				},
				{ $sort: { favoritesCount: -1, lastFavoritedAt: -1 } },
				{ $limit: 10 },
				{
					$lookup: {
						from: "songs",
						localField: "_id",
						foreignField: "_id",
						as: "song",
					},
				},
				{ $unwind: "$song" },
				{
					$lookup: {
						from: "users",
						localField: "song.uploadedBy",
						foreignField: "_id",
						as: "uploadedBy",
					},
				},
				{
					$project: {
						_id: "$song._id",
						title: "$song.title",
						artist: "$song.artist",
						imageUrl: "$song.imageUrl",
						genre: "$song.genre",
						source: "$song.source",
						playCount: "$song.playCount",
						duration: "$song.duration",
						favoritesCount: 1,
						lastFavoritedAt: 1,
						uploadedBy: {
							$arrayElemAt: ["$uploadedBy", 0],
						},
					},
				},
			]),
		]);

		const [totalPlaylists, playlistCreators, totalFavoriteActions, uniqueFavoritedSongs, playlistTotals] = overviewAggregation;
		const playlistOwnerIds = [...new Set(rawPlaylists.map((playlist) => playlist.userId).filter(Boolean))];
		const owners = await User.find({ clerkId: { $in: playlistOwnerIds } }, "fullName imageUrl clerkId role createdAt").lean();
		const ownerMap = new Map(owners.map((owner) => [owner.clerkId, owner]));

		const playlists = rawPlaylists.map((playlist) => ({
			_id: playlist._id,
			name: playlist.name,
			description: playlist.description || "",
			userId: playlist.userId,
			songCount: playlist.songs.length,
			totalDuration: playlist.songs.reduce((total, song) => total + (song?.duration || 0), 0),
			createdAt: playlist.createdAt,
			updatedAt: playlist.updatedAt,
			owner: ownerMap.get(playlist.userId) || null,
			songs: playlist.songs,
		}));

		res.status(200).json({
			overview: {
				totalPlaylists,
				activePlaylistCreators: playlistCreators.length,
				totalFavoriteActions,
				uniqueFavoritedSongs: uniqueFavoritedSongs.length,
				avgSongsPerPlaylist: totalPlaylists ? Number(((playlistTotals[0]?.totalSongs || 0) / totalPlaylists).toFixed(1)) : 0,
			},
			playlists,
			topFavoritedSongs: topFavoritedSongs,
		});
	} catch (error) {
		next(error);
	}
};

export const getCommunityInsights = async (req, res, next) => {
	try {
		const [subscribers, feedback, topAuthorsAggregation] = await Promise.all([
			User.find({ newsletterSubscribed: true })
				.select("fullName imageUrl clerkId role createdAt updatedAt")
				.sort({ updatedAt: -1 })
				.lean(),
			Feedback.find()
				.populate("author", "fullName imageUrl clerkId role")
				.populate("song", "title artist imageUrl")
				.populate("album", "title artist imageUrl")
				.sort({ createdAt: -1 })
				.lean(),
			Feedback.aggregate([
				{
					$project: {
						author: 1,
						likesCount: { $size: "$likes" },
						commentsCount: { $size: "$comments" },
						createdAt: 1,
					},
				},
				{
					$group: {
						_id: "$author",
						feedbackCount: { $sum: 1 },
						totalLikes: { $sum: "$likesCount" },
						totalComments: { $sum: "$commentsCount" },
						lastFeedbackAt: { $max: "$createdAt" },
					},
				},
				{ $sort: { feedbackCount: -1, totalLikes: -1, lastFeedbackAt: -1 } },
				{ $limit: 10 },
				{
					$lookup: {
						from: "users",
						localField: "_id",
						foreignField: "_id",
						as: "author",
					},
				},
				{
					$project: {
						_id: 0,
						feedbackCount: 1,
						totalLikes: 1,
						totalComments: 1,
						lastFeedbackAt: 1,
						author: { $arrayElemAt: ["$author", 0] },
					},
				},
			]),
		]);

		const normalizedFeedback = feedback.map((item) => ({
			_id: item._id,
			content: item.content,
			category: item.category,
			createdAt: item.createdAt,
			author: item.author,
			likesCount: item.likes.length,
			commentsCount: item.comments.length,
			song: item.song,
			album: item.album,
		}));

		res.status(200).json({
			overview: {
				newsletterSubscribers: subscribers.length,
				totalFeedback: normalizedFeedback.length,
				totalFeedbackLikes: normalizedFeedback.reduce((sum, item) => sum + item.likesCount, 0),
				totalFeedbackComments: normalizedFeedback.reduce((sum, item) => sum + item.commentsCount, 0),
			},
			subscribers,
			feedback: normalizedFeedback,
			topAuthors: topAuthorsAggregation,
		});
	} catch (error) {
		next(error);
	}
};

export const getAllUsers = async (req, res, next) => {
	try {
		const users = await User.find().sort({ createdAt: -1 });
		res.status(200).json(users);
	} catch (error) {
		next(error);
	}
};

export const updateUser = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { role } = req.body;
		const { User } = await import("../models/user.model.js");

		if (role && !["user", "admin", "artist"].includes(role)) {
			return res.status(400).json({ message: "Invalid role" });
		}

		const updateData = {};
		if (role) updateData.role = role;

		const user = await User.findByIdAndUpdate(id, updateData, { new: true });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.status(200).json(user);
	} catch (error) {
		next(error);
	}
};

export const deleteUser = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { User } = await import("../models/user.model.js");

		const user = await User.findByIdAndDelete(id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.status(200).json({ message: "User deleted successfully" });
	} catch (error) {
		next(error);
	}
};





