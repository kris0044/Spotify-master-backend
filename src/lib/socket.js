import { Server } from "socket.io";
import { Message } from "../models/message.model.js";

let ioInstance = null;
const userSockets = new Map(); // { userId: socketId }
const userActivities = new Map(); // { userId: activity }

export const initializeSocket = (server) => {
	ioInstance = new Server(server, {
		cors: {
			origin: "*",
		},
	});

	ioInstance.on("connection", (socket) => {
		socket.on("user_connected", (userId) => {
			userSockets.set(userId, socket.id);
			userActivities.set(userId, "Idle");

			// broadcast to all connected sockets that this user just logged in
			ioInstance.emit("user_connected", userId);

			socket.emit("users_online", Array.from(userSockets.keys()));
			ioInstance.emit("activities", Array.from(userActivities.entries()));
		});

		socket.on("update_activity", ({ userId, activity }) => {
			console.log("activity updated", userId, activity);
			userActivities.set(userId, activity);
			ioInstance.emit("activity_updated", { userId, activity });
		});

		socket.on("send_message", async (data) => {
			try {
				const { senderId, receiverId, content } = data;

				const message = await Message.create({
					senderId,
					receiverId,
					content,
				});

				// send to receiver in realtime, if they're online
				const receiverSocketId = userSockets.get(receiverId);
				if (receiverSocketId) {
					ioInstance.to(receiverSocketId).emit("receive_message", message);
				}

				socket.emit("message_sent", message);
			} catch (error) {
				console.error("Message error:", error);
				socket.emit("message_error", error.message);
			}
		});

		socket.on("disconnect", () => {
			let disconnectedUserId;
			for (const [userId, socketId] of userSockets.entries()) {
				if (socketId === socket.id) {
					disconnectedUserId = userId;
					userSockets.delete(userId);
					userActivities.delete(userId);
					break;
				}
			}
			if (disconnectedUserId) {
				ioInstance.emit("user_disconnected", disconnectedUserId);
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
