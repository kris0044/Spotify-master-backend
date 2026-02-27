import { Router } from "express";
import {
	uploadSong,
	uploadAlbum,
	getMyUploads,
} from "../controller/artist.controller.js";
import { protectRoute, requireArtist } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);
router.use(requireArtist);

router.post("/songs", uploadSong);
router.post("/albums", uploadAlbum);
router.get("/uploads", getMyUploads);

export default router;

