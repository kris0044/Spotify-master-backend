import { Router } from "express";
import {
	addToFavorites,
	removeFromFavorites,
	getUserFavorites,
	checkIsFavorite,
} from "../controller/favorite.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/:songId/check", checkIsFavorite);

router.use(protectRoute);

router.post("/", addToFavorites);
router.delete("/:songId", removeFromFavorites);
router.get("/", getUserFavorites);

export default router;

