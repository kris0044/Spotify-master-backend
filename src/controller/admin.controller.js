import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import cloudinary from "../lib/cloudinary.js";

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
			isApproved: true, // Admin-created songs are auto-approved
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
		const { title, artist, releaseYear } = req.body;
		const { imageFile } = req.files;

		const imageUrl = await uploadToCloudinary(imageFile);

		const album = new Album({
			title,
			artist,
			imageUrl,
			releaseYear,
			isApproved: true, // Admin-created albums are auto-approved
		});

		await album.save();

		res.status(201).json(album);
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
		// If no auth object or no userId, user is not authenticated
		if (!req.auth || !req.auth.userId) {
			console.log("❌ No auth or userId found");
			return res.status(200).json({ admin: false });
		}

		console.log("✅ Checking admin status for userId:", req.auth.userId);

		// Check if user is admin by email
		let isAdminByEmail = false;
		let clerkUser = null;
		
		try {
			const { clerkClient } = await import("@clerk/express");
			clerkUser = await clerkClient.users.getUser(req.auth.userId);
			const userEmail = clerkUser.primaryEmailAddress?.emailAddress;
			
			console.log("📧 User email:", userEmail);
			console.log("🔑 Admin email:", process.env.ADMIN_EMAIL);
			
			isAdminByEmail = userEmail === process.env.ADMIN_EMAIL;
			console.log("📋 Is admin by email?", isAdminByEmail);
		} catch (clerkError) {
			console.error("❌ Clerk API error:", clerkError.message);
			// Continue to check database, don't return false yet
		}

		// Check database role
		const { User } = await import("../models/user.model.js");
		const dbUser = await User.findOne({ clerkId: req.auth.userId });
		
		console.log("💾 Database user found?", !!dbUser);
		console.log("👤 Database user role:", dbUser?.role);
		
		const isAdminByRole = dbUser?.role === "admin";
		console.log("📋 Is admin by role?", isAdminByRole);

		const isAdmin = isAdminByEmail || isAdminByRole;
		
		console.log("🎯 FINAL RESULT - Is Admin?", isAdmin);

		res.status(200).json({ admin: isAdmin });
	} catch (error) {
		// Log the full error so you can see what's wrong
		console.error("❌ CRITICAL ERROR in checkAdmin:", error);
		console.error("Stack trace:", error.stack);
		
		// Return error details in development
		if (process.env.NODE_ENV === 'development') {
			res.status(500).json({ 
				admin: false, 
				error: error.message,
				details: "Check server logs"
			});
		} else {
			res.status(200).json({ admin: false });
		}
	}
};

export const updateSong = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { title, artist, duration, albumId } = req.body;
		const updateData = {};

		if (title) updateData.title = title;
		if (artist) updateData.artist = artist;
		if (duration) updateData.duration = duration;
		if (albumId !== undefined) updateData.albumId = albumId || null;

		// Handle image update if provided
		if (req.files?.imageFile) {
			updateData.imageUrl = await uploadToCloudinary(req.files.imageFile);
		}

		const song = await Song.findByIdAndUpdate(id, updateData, { new: true });

		if (!song) {
			return res.status(404).json({ message: "Song not found" });
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
		const { title, artist, releaseYear } = req.body;
		const updateData = {};

		if (title) updateData.title = title;
		if (artist) updateData.artist = artist;
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

export const getAllUsers = async (req, res, next) => {
	try {
		const { User } = await import("../models/user.model.js");
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
