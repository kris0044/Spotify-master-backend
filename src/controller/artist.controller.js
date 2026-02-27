import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { User } from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";

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

		const { title, artist, albumId, duration } = req.body;
		const audioFile = req.files.audioFile;
		const imageFile = req.files.imageFile;

		const audioUrl = await uploadToCloudinary(audioFile);
		const imageUrl = await uploadToCloudinary(imageFile);

		const song = new Song({
			title,
			artist,
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

		const { title, artist, releaseYear } = req.body;
		const { imageFile } = req.files;

		if (!imageFile) {
			return res.status(400).json({ message: "Please upload album image" });
		}

		const imageUrl = await uploadToCloudinary(imageFile);

		const album = new Album({
			title,
			artist,
			imageUrl,
			releaseYear,
			uploadedBy: user._id,
			isApproved: false, // Requires admin approval
		});

		await album.save();

		res.status(201).json(album);
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

