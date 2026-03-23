import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		artist: { type: String, required: true },
		genre: { type: String, required: false, default: null, trim: true },
		imageUrl: { type: String, required: true },
		releaseYear: { type: Number, required: true },
		songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		isApproved: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
); //  createdAt, updatedAt

export const Album = mongoose.model("Album", albumSchema);
