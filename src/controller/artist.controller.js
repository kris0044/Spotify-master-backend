import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js";
import { PlayHistory } from "../models/playHistory.model.js";
import cloudinary from "../lib/cloudinary.js";
import { emitToUser } from "../lib/socket.js";
import { invalidateCacheByPrefixes } from "../lib/cache.js";

const RESOURCE_CACHE_PREFIXES = ["songs:list", "albums:list", "stats:list"];

// helper function for cloudinary uploads
const uploadToCloudinary = async (file) => {
	try {
		const result = await cloudinary.uploader.upload(file.tempFilePath, {
			resource_type: "auto",
		});

		return result.secure_url;
	} catch (error) {
		console.log("Error in uploadToCloudinary", error);
		throw new Error("Error uploading to cloudinary");
	}
};

const notifyArtistFollowers = async (artistUser, song) => {
	if (!artistUser || artistUser.role !== "artist") {
		return;
	}

	const followers = await Follow.find({
		followingId: artistUser._id,
		followingModel: "Artist",
	})
		.populate("followerId", "clerkId")
		.lean();

	for (const follow of followers) {
		const followerClerkId = follow?.followerId?.clerkId;
		if (!followerClerkId) continue;
		emitToUser(followerClerkId, "artist_new_song", {
			artistId: artistUser._id,
			artistName: artistUser.fullName,
			song: {
				_id: song._id,
				title: song.title,
				artist: song.artist,
				imageUrl: song.imageUrl,
				audioUrl: song.audioUrl,
				isApproved: song.isApproved,
				createdAt: song.createdAt,
			},
		});
	}
};

export const uploadSong = async (req, res, next) => {
	try {
		if (!req.files || !req.files.audioFile || !req.files.imageFile) {
			return res.status(400).json({ message: "Please upload all files" });
		}

		const userId = req.auth.userId;
		const user = await User.findOne({ clerkId: userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
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
			uploadedBy: user._id,
			isApproved: false, // Requires admin approval
		});

		await song.save();

		// if song belongs to an album, update the album's songs array
		if (albumId) {
			await Album.findByIdAndUpdate(albumId, {
				$push: { songs: song._id },
			});
		}

		await notifyArtistFollowers(user, song);
		await invalidateCacheByPrefixes(RESOURCE_CACHE_PREFIXES);

		res.status(201).json(song);
	} catch (error) {
		console.log("Error in uploadSong", error);
		next(error);
	}
};

export const uploadAlbum = async (req, res, next) => {
	try {
		const userId = req.auth.userId;
		const user = await User.findOne({ clerkId: userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const { title, artist, genre, releaseYear } = req.body;
		const { imageFile } = req.files || {};

		if (!imageFile) {
			return res.status(400).json({ message: "Please upload album image" });
		}

		const imageUrl = await uploadToCloudinary(imageFile);
		const parsedSongs = req.body.songs ? JSON.parse(req.body.songs) : [];

		const album = new Album({
			title,
			artist,
			genre: genre?.trim() || null,
			imageUrl,
			releaseYear,
			uploadedBy: user._id,
			isApproved: false, // Requires admin approval
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
				uploadedBy: user._id,
				isApproved: false,
			});

			createdSongs.push(song._id);
		}

		if (createdSongs.length) {
			album.songs = createdSongs;
			await album.save();
		}

		await invalidateCacheByPrefixes(RESOURCE_CACHE_PREFIXES);
		const populatedAlbum = await Album.findById(album._id).populate("songs");

		res.status(201).json(populatedAlbum);
	} catch (error) {
		console.log("Error in uploadAlbum", error);
		next(error);
	}
};

export const getMyUploads = async (req, res, next) => {
	try {
		const userId = req.auth.userId;
		const user = await User.findOne({ clerkId: userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const songs = await Song.find({ uploadedBy: user._id }).sort({
			createdAt: -1,
		});
		const albums = await Album.find({ uploadedBy: user._id }).sort({
			createdAt: -1,
		});

		res.status(200).json({ songs, albums });
	} catch (error) {
		next(error);
	}
};

export const getArtistSongs = async (req, res, next) => {
	try {
		const songs = await Song.find({ uploadedBy: req.user._id })
			.select("title artist genre imageUrl audioUrl duration albumId isApproved playCount createdAt updatedAt")
			.sort({ createdAt: -1 });

		res.status(200).json(songs);
	} catch (error) {
		next(error);
	}
};

export const deleteArtistSong = async (req, res, next) => {
	try {
		const { id } = req.params;
		const song = await Song.findOne({ _id: id, uploadedBy: req.user._id });

		if (!song) {
			return res.status(404).json({ message: "Song not found or you do not have access" });
		}

		if (song.albumId) {
			await Album.findByIdAndUpdate(song.albumId, { $pull: { songs: song._id } });
		}

		await Song.findByIdAndDelete(song._id);
		await PlayHistory.deleteMany({ songId: song._id });
		await Follow.deleteMany({ followingModel: "Song", followingId: song._id });
		await invalidateCacheByPrefixes(RESOURCE_CACHE_PREFIXES);

		res.status(200).json({ message: "Song deleted successfully" });
	} catch (error) {
		next(error);
	}
};

export const getArtistDashboard = async (req, res, next) => {
	try {
		const artistId = req.user._id;

		const [playStats, followerCount, topSongs, totalSongs] = await Promise.all([
			PlayHistory.aggregate([
				{ $lookup: { from: "songs", localField: "songId", foreignField: "_id", as: "song" } },
				{ $unwind: "$song" },
				{ $match: { "song.uploadedBy": artistId } },
				{
					$group: {
						_id: null,
						totalPlays: { $sum: "$playCount" },
						uniqueListeners: { $addToSet: "$userId" },
					},
				},
				{
					$project: {
						_id: 0,
						totalPlays: 1,
						uniqueListeners: { $size: "$uniqueListeners" },
					},
				},
			]),
			Follow.countDocuments({ followingId: artistId, followingModel: "Artist" }),
			Song.aggregate([
				{ $match: { uploadedBy: artistId } },
				{
					$lookup: {
						from: "playhistories",
						let: { songId: "$_id" },
						pipeline: [
							{ $match: { $expr: { $eq: ["$songId", "$$songId"] } } },
							{ $group: { _id: null, totalPlays: { $sum: "$playCount" } } },
						],
						as: "playStats",
					},
				},
				{
					$addFields: {
						totalPlays: { $ifNull: [{ $arrayElemAt: ["$playStats.totalPlays", 0] }, 0] },
					},
				},
				{ $project: { playStats: 0 } },
				{ $sort: { totalPlays: -1, createdAt: -1 } },
				{ $limit: 5 },
			]),
			Song.countDocuments({ uploadedBy: artistId }),
		]);

		res.status(200).json({
			totalPlays: playStats[0]?.totalPlays || 0,
			uniqueListeners: playStats[0]?.uniqueListeners || 0,
			followers: followerCount,
			totalSongs,
			topSongs,
		});
	} catch (error) {
		next(error);
	}
};
