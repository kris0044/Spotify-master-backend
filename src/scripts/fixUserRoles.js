import dotenv from "dotenv";
import { connectDB } from "../lib/db.js";
import { User } from "../models/user.model.js";

// Load environment variables
dotenv.config();

// Script to fix user roles - assign default "user" role to users without roles
const fixUserRoles = async () => {
	try {
		await connectDB();
		
		// Update all users that don't have a role set
		const result = await User.updateMany(
			{
				$or: [
					{ role: { $exists: false } },
					{ role: null },
					{ role: "" }
				]
			},
			{
				$set: { role: "user" }
			}
		);

		console.log(`Fixed roles for ${result.modifiedCount} users`);
		
		// Also ensure all users have the role field
		const allUsers = await User.find({});
		console.log(`Total users in database: ${allUsers.length}`);
		console.log(`Users by role:`);
		const roleCounts = {};
		allUsers.forEach(user => {
			const role = user.role || "no role";
			roleCounts[role] = (roleCounts[role] || 0) + 1;
		});
		console.log(roleCounts);
		
		process.exit(0);
	} catch (error) {
		console.error("Error fixing user roles:", error);
		process.exit(1);
	}
};

fixUserRoles();

