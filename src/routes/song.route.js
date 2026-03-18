import { Router } from "express";
import { getAllSongs, getFeaturedSongs, getMadeForYouSongs, getTrendingSongs, incrementPlayCount } from "../controller/song.controller.js";
import { populateUser } from "../middleware/user.middleware.js";
import { createCacheMiddleware, createInvalidationMiddleware } from "../middleware/cache.middleware.js";

const router = Router();

// Populate user info for filtering (optional - works for both authenticated and unauthenticated users)
router.use(populateUser);

router.get("/", createCacheMiddleware({ keyPrefix: "songs:list", ttlSeconds: 5 * 60 }), getAllSongs);
router.get("/featured", getFeaturedSongs);
router.get("/made-for-you", getMadeForYouSongs);
router.get("/trending", getTrendingSongs);
router.post("/:id/play", createInvalidationMiddleware(["songs:list"]), incrementPlayCount);

export default router;
