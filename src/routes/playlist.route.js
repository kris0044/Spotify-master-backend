import { Router } from "express";
import {
	createPlaylist,
	getUserPlaylists,
	getPlaylistById,
	updatePlaylist,
	deletePlaylist,
	addSongToPlaylist,
	removeSongFromPlaylist,
} from "../controller/playlist.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);

router.post("/", createPlaylist);
router.get("/", getUserPlaylists);
router.get("/:id", getPlaylistById);
router.put("/:id", updatePlaylist);
router.delete("/:id", deletePlaylist);
router.post("/:id/songs", addSongToPlaylist);
router.delete("/:id/songs/:songId", removeSongFromPlaylist);

export default router;

