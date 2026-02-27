import { Router } from "express";
import {
	checkAdmin,
	approveAllExistingSongs,
	createAlbum,
	createSong,
	deleteAlbum,
	deleteSong,
	updateSong,
	updateAlbum,
	approveSong,
	rejectSong,
	approveAlbum,
	rejectAlbum,
	getPendingSongs,
	getPendingAlbums,
	getAllUsers,
	updateUser,
	deleteUser,
} from "../controller/admin.controller.js";
import { protectRoute, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Check admin endpoint should work without requiring authentication
// It just checks if the current user (if authenticated) is an admin
router.get("/check", checkAdmin);

// All other routes require admin
router.use(protectRoute);
router.use(requireAdmin);

// Approve all existing songs (one-time migration)
router.post("/songs/approve-all-existing", approveAllExistingSongs);

// Songs
router.post("/songs", createSong);
router.put("/songs/:id", updateSong);
router.delete("/songs/:id", deleteSong);
router.post("/songs/:id/approve", approveSong);
router.post("/songs/:id/reject", rejectSong);
router.get("/songs/pending", getPendingSongs);

// Albums
router.post("/albums", createAlbum);
router.put("/albums/:id", updateAlbum);
router.delete("/albums/:id", deleteAlbum);
router.post("/albums/:id/approve", approveAlbum);
router.post("/albums/:id/reject", rejectAlbum);
router.get("/albums/pending", getPendingAlbums);

// Users
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
