import dotenv from "dotenv";
import { connectDB } from "../lib/db.js";
import { Song } from "../models/song.model.js";

// Load environment variables
dotenv.config();

// Script to approve all existing songs that don't have isApproved set
const approveExistingSongs = async () => {
	try {
		await connectDB();
		
		// Update all songs that don't have isApproved set or have it as false
		// This will approve existing songs for backward compatibility
		const result = await Song.updateMany(
			{
				$or: [
					{ isApproved: { $exists: false } },
					{ isApproved: false },
					{ isApproved: null }
				]
			},
			{
				$set: { isApproved: true }
			}
		);

		console.log(`Approved ${result.modifiedCount} existing songs`);
		process.exit(0);
	} catch (error) {
		console.error("Error approving songs:", error);
		process.exit(1);
	}
};

approveExistingSongs();

