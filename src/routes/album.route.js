import { Router } from "express";
import { getAlbumById, getAllAlbums } from "../controller/album.controller.js";
import { populateUser } from "../middleware/user.middleware.js";

const router = Router();

// Populate user info for filtering (optional - works for both authenticated and unauthenticated users)
router.use(populateUser);

router.get("/", getAllAlbums);
router.get("/:albumId", getAlbumById);

export default router;
