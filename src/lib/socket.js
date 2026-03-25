import { Server } from "socket.io";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

let ioInstance = null;
const userSockets = new Map(); // { userId: socketId }
const userActivities = new Map(); // { userId: activity }
const allowedOrigins = (process.env.CLERK_AUTHORIZED_PARTIES || "http://localhost:5173,http://127.0.0.1:5173")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

const normalizeActivityPayload = (payload = {}) => {
	const rawActivity = typeof payload.activity === "string" && payload.activity.trim() ? payload.activity.trim() : "Idle";
	const song = payload.song && typeof payload.song === "object" ? payload.song : null;

	return {
		activity: rawActivity,
		song: rawActivity === "Idle"
			? null
			: {
				title: song?.title || null,
				artist: song?.artist || null,
				imageUrl: song?.imageUrl || null,
			},
	};
};

const buildPresencePayload = async () => {
	const users = await User.find(
		{ clerkId: { $in: Array.from(userSockets.keys()) } },
		"clerkId isOnline lastSeenAt currentActivity currentSong"
	).lean();

	return users.map((user) => ({
		userId: user.clerkId,
		isOnline: Boolean(user.isOnline),
		lastSeenAt: user.lastSeenAt,
		activity: user.currentActivity || "Idle",
		song: user.currentSong || null,
	}));
};

export const initializeSocket = (server) => {
	ioInstance = new Server(server, {
		cors: {
			origin: allowedOrigins,
			credentials: true,
		},
	});

	ioInstance.on("connection", (socket) => {
		socket.on("user_connected", async (userId, acknowledgement) => {
			userSockets.set(userId, socket.id);
			socket.data.userId = userId;

			const existingUser = await User.findOne({ clerkId: userId }).select("currentActivity currentSong").lean();
			const initialActivity = existingUser?.currentActivity || "Idle";
			const initialSong = initialActivity === "Idle" ? null : existingUser?.currentSong || null;
			userActivities.set(userId, initialActivity);

			try {
				await User.findOneAndUpdate(
					{ clerkId: userId },
					{
						$set: {
							isOnline: true,
							lastSeenAt: null,
							currentActivity: initialActivity,
							currentSong: initialSong,
						},
					}
				);
			} catch (error) {
				console.error("Failed to persist socket connection state:", error.message);
			}

			// broadcast to all connected sockets that this user just logged in
			ioInstance.emit("user_connected", userId);

			socket.emit("users_online", Array.from(userSockets.keys()));
			ioInstance.emit("activities", Array.from(userActivities.entries()));
			try {
				ioInstance.emit("presence_snapshot", await buildPresencePayload());
			} catch (error) {
				console.error("Failed to emit presence snapshot:", error.message);
			}

			if (typeof acknowledgement === "function") {
				acknowledgement({ ok: true });
			}
		});

		socket.on("update_activity", async ({ userId, activity, song }) => {
			const normalized = normalizeActivityPayload({ activity, song });
			console.log("activity updated", userId, normalized.activity);
			userActivities.set(userId, normalized.activity);

			try {
				await User.findOneAndUpdate(
					{ clerkId: userId },
					{
						$set: {
							currentActivity: normalized.activity,
							currentSong: normalized.song,
							isOnline: true,
							lastSeenAt: null,
						},
					}
				);
			} catch (error) {
				console.error("Failed to persist activity update:", error.message);
			}

			ioInstance.emit("activity_updated", { userId, activity: normalized.activity, song: normalized.song });
		});

		socket.on("send_message", async (data, acknowledgement) => {
			try {
				const { senderId, receiverId, content } = data;

				if (!senderId || !receiverId || !content?.trim()) {
					const errorMessage = "senderId, receiverId and content are required";
					if (typeof acknowledgement === "function") {
						acknowledgement({ ok: false, error: errorMessage });
					}
					return socket.emit("message_error", errorMessage);
				}

				const message = await Message.create({
					senderId,
					receiverId,
					content: content.trim(),
				});

				// send to receiver in realtime, if they're online
				const receiverSocketId = userSockets.get(receiverId);
				if (receiverSocketId) {
					ioInstance.to(receiverSocketId).emit("receive_message", message);
				}

				socket.emit("message_sent", message);
				if (typeof acknowledgement === "function") {
					acknowledgement({ ok: true, message });
				}
			} catch (error) {
				console.error("Message error:", error);
				if (typeof acknowledgement === "function") {
					acknowledgement({ ok: false, error: error.message });
				}
				socket.emit("message_error", error.message);
			}
		});

		socket.on("disconnect", async () => {
			const disconnectedUserId = socket.data.userId;

			if (disconnectedUserId) {
				userSockets.delete(disconnectedUserId);
				userActivities.delete(disconnectedUserId);

				try {
					await User.findOneAndUpdate(
						{ clerkId: disconnectedUserId },
						{
							$set: {
								isOnline: false,
								lastSeenAt: new Date(),
								currentActivity: "Idle",
								currentSong: null,
							},
						}
					);
				} catch (error) {
					console.error("Failed to persist disconnect state:", error.message);
				}
			}

			if (disconnectedUserId) {
				ioInstance.emit("user_disconnected", disconnectedUserId);
				try {
					ioInstance.emit("presence_snapshot", await buildPresencePayload());
				} catch (error) {
					console.error("Failed to emit presence snapshot:", error.message);
				}
			}
		});
	});
};

export const emitToUser = (userId, eventName, payload) => {
	if (!ioInstance || !userId) {
		return;
	}

	const socketId = userSockets.get(userId);
	if (socketId) {
		ioInstance.to(socketId).emit(eventName, payload);
	}
};
