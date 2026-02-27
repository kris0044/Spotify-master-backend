import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
	{
		userId: {
			type: String,
			required: true,
		},
		songId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Song",
			required: true,
		},
	},
	{ timestamps: true }
);

// Ensure one user can only favorite a song once
favoriteSchema.index({ userId: 1, songId: 1 }, { unique: true });

export const Favorite = mongoose.model("Favorite", favoriteSchema);

