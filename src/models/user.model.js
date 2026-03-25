import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		fullName: {
			type: String,
			required: true,
		},
		imageUrl: {
			type: String,
			required: true,
		},
		clerkId: {
			type: String,
			required: true,
			unique: true,
		},
		role: {
			type: String,
			enum: ["user", "admin", "artist"],
			default: "user",
		},
		newsletterSubscribed: {
			type: Boolean,
			default: false,
		},
		isOnline: {
			type: Boolean,
			default: false,
		},
		lastSeenAt: {
			type: Date,
			default: null,
		},
		currentActivity: {
			type: String,
			default: "Idle",
		},
		currentSong: {
			title: {
				type: String,
				default: null,
			},
			artist: {
				type: String,
				default: null,
			},
			imageUrl: {
				type: String,
				default: null,
			},
		},
	},
	{ timestamps: true } //  createdAt, updatedAt
);

export const User = mongoose.model("User", userSchema);
