import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";

export const createPlaylist = async (req, res, next) => {
	try {
		// protectRoute should have already checked this, but double-check
		if (!req.auth || !req.auth.userId) {
			console.log("createPlaylist: req.auth or userId missing", { auth: req.auth });
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const userId = req.auth.userId;

		const { name, description } = req.body;

		if (!name) {
			return res.status(400).json({ message: "Playlist name is required" });
		}

		const playlist = await Playlist.create({
			name,
			description: description || "",
			userId,
			songs: [],
		});

		res.status(201).json(playlist);
	} catch (error) {
		next(error);
	}
};

export const getUserPlaylists = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		
		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const playlists = await Playlist.find({ userId }).populate("songs");
		res.status(200).json(playlists);
	} catch (error) {
		next(error);
	}
};

export const getPlaylistById = async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const playlist = await Playlist.findOne({ _id: id, userId }).populate(
			"songs"
		);

		if (!playlist) {
			return res.status(404).json({ message: "Playlist not found" });
		}

		res.status(200).json(playlist);
	} catch (error) {
		next(error);
	}
};

export const updatePlaylist = async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.auth?.userId;
		
		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const { name, description } = req.body;

		const playlist = await Playlist.findOne({ _id: id, userId });

		if (!playlist) {
			return res.status(404).json({ message: "Playlist not found" });
		}

		if (name) playlist.name = name;
		if (description !== undefined) playlist.description = description;

		await playlist.save();

		res.status(200).json(playlist);
	} catch (error) {
		next(error);
	}
};

export const deletePlaylist = async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const playlist = await Playlist.findOneAndDelete({ _id: id, userId });

		if (!playlist) {
			return res.status(404).json({ message: "Playlist not found" });
		}

		res.status(200).json({ message: "Playlist deleted successfully" });
	} catch (error) {
		next(error);
	}
};

export const addSongToPlaylist = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { songId } = req.body;
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		if (!songId) {
			return res.status(400).json({ message: "Song ID is required" });
		}

		const playlist = await Playlist.findOne({ _id: id, userId });

		if (!playlist) {
			return res.status(404).json({ message: "Playlist not found" });
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
			return res.status(403).json({ message: "Cannot add unapproved song to playlist" });
		}

		if (playlist.songs.includes(songId)) {
			return res
				.status(400)
				.json({ message: "Song already in playlist" });
		}

		playlist.songs.push(songId);
		await playlist.save();

		const updatedPlaylist = await Playlist.findById(id).populate("songs");
		res.status(200).json(updatedPlaylist);
	} catch (error) {
		next(error);
	}
};

export const removeSongFromPlaylist = async (req, res, next) => {
	try {
		const { id, songId } = req.params;
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const playlist = await Playlist.findOne({ _id: id, userId });

		if (!playlist) {
			return res.status(404).json({ message: "Playlist not found" });
		}

		playlist.songs = playlist.songs.filter(
			(song) => song.toString() !== songId
		);
		await playlist.save();

		const updatedPlaylist = await Playlist.findById(id).populate("songs");
		res.status(200).json(updatedPlaylist);
	} catch (error) {
		next(error);
	}
};

