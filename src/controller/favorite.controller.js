import { Favorite } from "../models/favorite.model.js";
import { Song } from "../models/song.model.js";

export const addToFavorites = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const { songId } = req.body;

		if (!songId) {
			return res.status(400).json({ message: "Song ID is required" });
		}

		const song = await Song.findById(songId);
		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		// Check if user is admin or if song is approved
		const { User } = await import("../models/user.model.js");
		const user = await User.findOne({ clerkId: userId });
		
		// For backward compatibility: treat undefined/null isApproved as approved
		const isSongApproved = song.isApproved === true || song.isApproved === undefined || song.isApproved === null;
		
		if (user?.role !== "admin" && !isSongApproved) {
			return res.status(403).json({ message: "Cannot favorite unapproved song" });
		}

		// Check if already favorited
		const existingFavorite = await Favorite.findOne({ userId, songId });
		if (existingFavorite) {
			return res.status(400).json({ message: "Song already in favorites" });
		}

		const favorite = await Favorite.create({ userId, songId });
		const favoriteWithSong = await Favorite.findById(favorite._id).populate(
			"songId"
		);

		res.status(201).json(favoriteWithSong);
	} catch (error) {
		if (error.code === 11000) {
			return res.status(400).json({ message: "Song already in favorites" });
		}
		next(error);
	}
};

export const removeFromFavorites = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const { songId } = req.params;

		const favorite = await Favorite.findOneAndDelete({ userId, songId });

		if (!favorite) {
			return res.status(404).json({ message: "Favorite not found" });
		}

		res.status(200).json({ message: "Removed from favorites" });
	} catch (error) {
		next(error);
	}
};

export const getUserFavorites = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const favorites = await Favorite.find({ userId }).populate("songId");

		const songs = favorites.map((fav) => fav.songId);
		res.status(200).json(songs);
	} catch (error) {
		next(error);
	}
};

export const checkIsFavorite = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(200).json({ isFavorite: false });
		}

		const { songId } = req.params;

		const favorite = await Favorite.findOne({ userId, songId });
		res.status(200).json({ isFavorite: !!favorite });
	} catch (error) {
		next(error);
	}
};

