import { Router } from "express";
import { getPublicMusicCharts, resolvePublicMusicSong, searchPublicMusic } from "../controller/publicMusic.controller.js";

const router = Router();

router.get("/search", searchPublicMusic);
router.get("/charts", getPublicMusicCharts);
router.post("/resolve", resolvePublicMusicSong);

export default router;
