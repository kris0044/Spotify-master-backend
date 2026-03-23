import { Router } from "express";
import {
	addFeedbackComment,
	createFeedback,
	getFeedbackFeed,
	toggleFeedbackLike,
} from "../controller/feedback.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getFeedbackFeed);
router.post("/", protectRoute, createFeedback);
router.post("/:id/like", protectRoute, toggleFeedbackLike);
router.post("/:id/comments", protectRoute, addFeedbackComment);

export default router;
