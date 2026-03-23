import mongoose from "mongoose";

const playQueueSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			unique: true,
		},
		songs: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Song",
			},
		],
	},
	{ timestamps: true }
);

export const PlayQueue = mongoose.model("PlayQueue", playQueueSchema);
