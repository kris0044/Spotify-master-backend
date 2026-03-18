import { Router } from "express";
import { getRecommendations } from "../controller/recommendation.controller.js";
import { protectRecommendations } from "../middleware/recommendation.middleware.js";

const router = Router();

router.get("/", protectRecommendations, getRecommendations);

export default router;
