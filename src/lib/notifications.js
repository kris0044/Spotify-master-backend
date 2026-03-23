import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { emitToUser } from "./socket.js";

export const createNotification = async ({ userId, type, title, message, link = "", metadata = {} }) => {
	const notification = await Notification.create({
		user: userId,
		type,
		title,
		message,
		link,
		metadata,
	});

	const populated = await notification.populate("user", "fullName imageUrl clerkId");
	if (populated.user?.clerkId) {
		emitToUser(populated.user.clerkId, "notification:new", populated);
	}

	return populated;
};

export const notifyNewsletterSubscribersAboutSong = async (song) => {
	const subscribers = await User.find({ newsletterSubscribed: true }).select("_id");

	if (!subscribers.length) {
		return;
	}

	await Promise.all(
		subscribers.map((subscriber) =>
			createNotification({
				userId: subscriber._id,
				type: "song",
				title: "New release added",
				message: `${song.title} by ${song.artist} is now available.`,
				link: `/songs`,
				metadata: { songId: song._id, albumId: song.albumId || null },
			})
		)
	);
};

export const notifyNewsletterSubscribersAboutAlbum = async (album, songsCount) => {
	const subscribers = await User.find({ newsletterSubscribed: true }).select("_id");

	if (!subscribers.length) {
		return;
	}

	await Promise.all(
		subscribers.map((subscriber) =>
			createNotification({
				userId: subscriber._id,
				type: "album",
				title: "New album added",
				message: `${album.title} by ${album.artist} was added with ${songsCount} new song${songsCount === 1 ? "" : "s"}.`,
				link: `/albums/${album._id}`,
				metadata: { albumId: album._id, songsCount },
			})
		)
	);
};
