import { Router } from "express";
import { protectRoute, requireAdmin } from "../middleware/auth.middleware.js";
import { getStats } from "../controller/stat.controller.js";
import { createCacheMiddleware } from "../middleware/cache.middleware.js";

const router = Router();

router.get("/", createCacheMiddleware({ keyPrefix: "stats:list", ttlSeconds: 60 }), getStats);

export default router;
