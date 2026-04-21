import { Router } from "express";
import {
	getPublicMusicAlbum,
	getPublicMusicCharts,
	resolvePublicMusicSong,
	searchPublicMusic,
	searchPublicMusicAlbums,
} from "../controller/publicMusic.controller.js";

const router = Router();

router.get("/albums", searchPublicMusicAlbums);
router.get("/albums/:albumId", getPublicMusicAlbum);
router.get("/search", searchPublicMusic);
router.get("/charts", getPublicMusicCharts);
router.post("/resolve", resolvePublicMusicSong);

export default router;
