import { User } from "../models/user.model.js";
import { Message } from "../models/message.model.js";
import { Notification } from "../models/notification.model.js";
import { PlayQueue } from "../models/playQueue.model.js";
import { Song } from "../models/song.model.js";

const APPROVED_SONG_FILTER = {
	$or: [{ isApproved: true }, { isApproved: { $exists: false } }, { isApproved: null }],
};

const getUserWithQueue = async (clerkUserId) => {
	const user = await User.findOne({ clerkId: clerkUserId });
	if (!user) {
		return { user: null, queue: null };
	}

	const queue = await PlayQueue.findOneAndUpdate(
		{ user: user._id },
		{ $setOnInsert: { user: user._id, songs: [] } },
		{ upsert: true, new: true }
	).populate("songs");

	return { user, queue };
};

export const getCurrentUser = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const user = await User.findOne({ clerkId: userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.status(200).json(user);
	} catch (error) {
		next(error);
	}
};

export const getAllUsers = async (req, res, next) => {
	try {
		const currentUserId = req.auth.userId;
		const users = await User.find({ clerkId: { $ne: currentUserId } });
		res.status(200).json(users);
	} catch (error) {
		next(error);
	}
};

export const getMessages = async (req, res, next) => {
	try {
		const myId = req.auth.userId;
		const { userId } = req.params;

		const messages = await Message.find({
			$or: [
				{ senderId: userId, receiverId: myId },
				{ senderId: myId, receiverId: userId },
			],
		}).sort({ createdAt: 1 });

		res.status(200).json(messages);
	} catch (error) {
		next(error);
	}
};

export const toggleNewsletterSubscription = async (req, res, next) => {
	try {
		const user = await User.findOne({ clerkId: req.auth.userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		user.newsletterSubscribed = !user.newsletterSubscribed;
		await user.save();

		res.status(200).json({
			newsletterSubscribed: user.newsletterSubscribed,
		});
	} catch (error) {
		next(error);
	}
};

export const getMyNotifications = async (req, res, next) => {
	try {
		const user = await User.findOne({ clerkId: req.auth.userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const notifications = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(50);
		const unreadCount = notifications.filter((notification) => !notification.isRead).length;

		res.status(200).json({ notifications, unreadCount });
	} catch (error) {
		next(error);
	}
};

export const markNotificationRead = async (req, res, next) => {
	try {
		const user = await User.findOne({ clerkId: req.auth.userId });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, user: user._id },
			{ isRead: true },
			{ new: true }
		);

		if (!notification) {
			return res.status(404).json({ message: "Notification not found" });
		}

		res.status(200).json(notification);
	} catch (error) {
		next(error);
	}
};

export const getMyQueue = async (req, res, next) => {
	try {
		const { user, queue } = await getUserWithQueue(req.auth.userId);

		if (!user || !queue) {
			return res.status(404).json({ message: "User not found" });
		}

		res.status(200).json({ songs: queue.songs.filter(Boolean) });
	} catch (error) {
		next(error);
	}
};

export const addSongToQueue = async (req, res, next) => {
	try {
		const { songId } = req.body;
		if (!songId) {
			return res.status(400).json({ message: "songId is required" });
		}

		const { user, queue } = await getUserWithQueue(req.auth.userId);
		if (!user || !queue) {
			return res.status(404).json({ message: "User not found" });
		}

		const visibilityFilter = user.role === "admin" ? {} : APPROVED_SONG_FILTER;
		const song = await Song.findOne({ _id: songId, ...visibilityFilter });
		if (!song) {
			return res.status(404).json({ message: "Song not found" });
		}

		queue.songs.push(song._id);
		await queue.save();
		await queue.populate("songs");

		res.status(200).json({ songs: queue.songs.filter(Boolean) });
	} catch (error) {
		next(error);
	}
};

export const removeSongFromQueue = async (req, res, next) => {
	try {
		const { user, queue } = await getUserWithQueue(req.auth.userId);
		if (!user || !queue) {
			return res.status(404).json({ message: "User not found" });
		}

		queue.songs = queue.songs.filter((songId) => songId.toString() !== req.params.songId);
		await queue.save();
		await queue.populate("songs");

		res.status(200).json({ songs: queue.songs.filter(Boolean) });
	} catch (error) {
		next(error);
	}
};

export const clearMyQueue = async (req, res, next) => {
	try {
		const { user, queue } = await getUserWithQueue(req.auth.userId);
		if (!user || !queue) {
			return res.status(404).json({ message: "User not found" });
		}

		queue.songs = [];
		await queue.save();

		res.status(200).json({ songs: [] });
	} catch (error) {
		next(error);
	}
};

export const consumeNextQueuedSong = async (req, res, next) => {
	try {
		const { user, queue } = await getUserWithQueue(req.auth.userId);
		if (!user || !queue) {
			return res.status(404).json({ message: "User not found" });
		}

		const nextSongId = queue.songs.shift() || null;
		await queue.save();
		await queue.populate("songs");

		const nextSong = nextSongId ? await Song.findById(nextSongId) : null;

		res.status(200).json({
			song: nextSong,
			songs: queue.songs.filter(Boolean),
		});
	} catch (error) {
		next(error);
	}
};
