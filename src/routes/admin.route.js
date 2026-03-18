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
import { createInvalidationMiddleware } from "../middleware/cache.middleware.js";

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
router.post("/songs", createInvalidationMiddleware(["songs:list", "stats:list"]), createSong);
router.put("/songs/:id", createInvalidationMiddleware(["songs:list", "stats:list"]), updateSong);
router.delete("/songs/:id", createInvalidationMiddleware(["songs:list", "stats:list"]), deleteSong);
router.post("/songs/:id/approve", createInvalidationMiddleware(["songs:list", "stats:list"]), approveSong);
router.post("/songs/:id/reject", createInvalidationMiddleware(["songs:list", "stats:list"]), rejectSong);
router.get("/songs/pending", getPendingSongs);

// Albums
router.post("/albums", createInvalidationMiddleware(["albums:list", "songs:list", "stats:list"]), createAlbum);
router.put("/albums/:id", createInvalidationMiddleware(["albums:list", "songs:list", "stats:list"]), updateAlbum);
router.delete("/albums/:id", createInvalidationMiddleware(["albums:list", "songs:list", "stats:list"]), deleteAlbum);
router.post("/albums/:id/approve", createInvalidationMiddleware(["albums:list", "songs:list", "stats:list"]), approveAlbum);
router.post("/albums/:id/reject", createInvalidationMiddleware(["albums:list", "songs:list", "stats:list"]), rejectAlbum);
router.get("/albums/pending", getPendingAlbums);

// Users
router.get("/users", getAllUsers);
router.put("/users/:id", createInvalidationMiddleware(["stats:list"]), updateUser);
router.delete("/users/:id", createInvalidationMiddleware(["stats:list"]), deleteUser);

export default router;
