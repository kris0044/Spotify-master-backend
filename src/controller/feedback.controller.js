import { Album } from "../models/album.model.js";
import { Feedback } from "../models/feedback.model.js";
import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";

const ensureCurrentUser = async (req) => {
	const dbUser = await User.findOne({ clerkId: req.auth.userId });
	return dbUser;
};

export const getFeedbackFeed = async (req, res, next) => {
	try {
		const feedback = await Feedback.find()
			.populate("author", "fullName imageUrl clerkId")
			.populate("song", "title artist imageUrl")
			.populate("album", "title artist imageUrl")
			.populate("comments.user", "fullName imageUrl clerkId")
			.sort({ createdAt: -1 });

		res.status(200).json(feedback);
	} catch (error) {
		next(error);
	}
};

export const createFeedback = async (req, res, next) => {
	try {
		const currentUser = await ensureCurrentUser(req);

		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const { content, category = "general", songId, albumId } = req.body;

		if (!content?.trim()) {
			return res.status(400).json({ message: "Feedback content is required" });
		}

		if (songId) {
			const song = await Song.findById(songId);
			if (!song) {
				return res.status(404).json({ message: "Song not found" });
			}
		}

		if (albumId) {
			const album = await Album.findById(albumId);
			if (!album) {
				return res.status(404).json({ message: "Album not found" });
			}
		}

		const feedback = await Feedback.create({
			author: currentUser._id,
			content: content.trim(),
			category,
			song: songId || null,
			album: albumId || null,
		});

		const populated = await Feedback.findById(feedback._id)
			.populate("author", "fullName imageUrl clerkId")
			.populate("song", "title artist imageUrl")
			.populate("album", "title artist imageUrl")
			.populate("comments.user", "fullName imageUrl clerkId");

		res.status(201).json(populated);
	} catch (error) {
		next(error);
	}
};

export const toggleFeedbackLike = async (req, res, next) => {
	try {
		const currentUser = await ensureCurrentUser(req);
		const { id } = req.params;

		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const feedback = await Feedback.findById(id);

		if (!feedback) {
			return res.status(404).json({ message: "Feedback not found" });
		}

		const alreadyLiked = feedback.likes.some((likeId) => likeId.toString() === currentUser._id.toString());

		if (alreadyLiked) {
			feedback.likes = feedback.likes.filter((likeId) => likeId.toString() !== currentUser._id.toString());
		} else {
			feedback.likes.push(currentUser._id);
		}

		await feedback.save();

		const populated = await Feedback.findById(id)
			.populate("author", "fullName imageUrl clerkId")
			.populate("song", "title artist imageUrl")
			.populate("album", "title artist imageUrl")
			.populate("comments.user", "fullName imageUrl clerkId");

		res.status(200).json(populated);
	} catch (error) {
		next(error);
	}
};

export const addFeedbackComment = async (req, res, next) => {
	try {
		const currentUser = await ensureCurrentUser(req);
		const { id } = req.params;
		const { content } = req.body;

		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		if (!content?.trim()) {
			return res.status(400).json({ message: "Comment content is required" });
		}

		const feedback = await Feedback.findById(id);

		if (!feedback) {
			return res.status(404).json({ message: "Feedback not found" });
		}

		feedback.comments.push({
			user: currentUser._id,
			content: content.trim(),
		});

		await feedback.save();

		const populated = await Feedback.findById(id)
			.populate("author", "fullName imageUrl clerkId")
			.populate("song", "title artist imageUrl")
			.populate("album", "title artist imageUrl")
			.populate("comments.user", "fullName imageUrl clerkId");

		res.status(201).json(populated);
	} catch (error) {
		next(error);
	}
};
