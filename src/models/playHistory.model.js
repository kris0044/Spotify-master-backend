import mongoose from "mongoose";

const playHistorySchema = new mongoose.Schema(
	{
		userId: {
			type: String,
			required: true,
			index: true,
		},
		songId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Song",
			required: true,
			index: true,
		},
		playCount: {
			type: Number,
			default: 1,
			min: 1,
		},
		lastPlayedAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
	},
	{ timestamps: true }
);

playHistorySchema.index({ userId: 1, songId: 1 }, { unique: true });

export const PlayHistory = mongoose.model("PlayHistory", playHistorySchema);
