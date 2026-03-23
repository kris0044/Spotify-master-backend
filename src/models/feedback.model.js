import mongoose from "mongoose";

const feedbackCommentSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
	},
	{ timestamps: true }
);

const feedbackSchema = new mongoose.Schema(
	{
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 1200,
		},
		category: {
			type: String,
			enum: ["general", "song", "album", "feature"],
			default: "general",
		},
		song: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Song",
			default: null,
		},
		album: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Album",
			default: null,
		},
		likes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		comments: [feedbackCommentSchema],
	},
	{ timestamps: true }
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);
