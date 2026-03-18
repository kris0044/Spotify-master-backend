import { Router } from "express";
import { getAlbumById, getAllAlbums } from "../controller/album.controller.js";
import { populateUser } from "../middleware/user.middleware.js";
import { createCacheMiddleware } from "../middleware/cache.middleware.js";

const router = Router();

// Populate user info for filtering (optional - works for both authenticated and unauthenticated users)
router.use(populateUser);

router.get("/", createCacheMiddleware({ keyPrefix: "albums:list", ttlSeconds: 10 * 60 }), getAllAlbums);
router.get("/:albumId", getAlbumById);

export default router;
