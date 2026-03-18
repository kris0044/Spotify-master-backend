import { Router } from "express";
import { getHistoryStats, getRecentlyPlayed, getTopPlayedSongs } from "../controller/history.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);

router.get("/recent", getRecentlyPlayed);
router.get("/top", getTopPlayedSongs);
router.get("/stats", getHistoryStats);

export default router;
