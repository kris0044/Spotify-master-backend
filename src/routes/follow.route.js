import { Router } from "express";
import {
	followTarget,
	getFollowers,
	getFollowing,
	unfollowTarget,
} from "../controller/follow.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);
router.post("/follow", followTarget);
router.delete("/unfollow", unfollowTarget);
router.get("/following", getFollowing);
router.get("/followers", getFollowers);

export default router;
