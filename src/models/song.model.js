import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		artist: {
			type: String,
			required: true,
		},
		genre: {
			type: String,
			required: false,
			default: null,
			trim: true,
		},
		imageUrl: {
			type: String,
			required: true,
		},
		audioUrl: {
			type: String,
			required: true,
		},
		playbackUrl: {
			type: String,
			required: false,
			default: null,
		},
		duration: {
			type: Number,
			required: true,
		},
		source: {
			type: String,
			required: false,
			default: "local",
		},
		externalVideoId: {
			type: String,
			required: false,
			default: null,
			unique: true,
			sparse: true,
		},
		albumId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Album",
			required: false,
		},
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		isApproved: {
			type: Boolean,
			default: false,
		},
		playCount: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

export const Song = mongoose.model("Song", songSchema);
