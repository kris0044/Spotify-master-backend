import { Router } from "express";
import {
	deleteArtistSong,
	getArtistDashboard,
	getArtistSongs,
	uploadSong,
	uploadAlbum,
	getMyUploads,
} from "../controller/artist.controller.js";
import { protectRoute, requireArtist } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);
router.use(requireArtist);

router.get("/dashboard", getArtistDashboard);
router.get("/songs", getArtistSongs);
router.post("/songs", uploadSong);
router.delete("/songs/:id", deleteArtistSong);
router.post("/albums", uploadAlbum);
router.get("/uploads", getMyUploads);

export default router;

