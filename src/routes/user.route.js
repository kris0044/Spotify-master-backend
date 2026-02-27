import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCurrentUser, getAllUsers, getMessages } from "../controller/user.controller.js";
const router = Router();

router.use(protectRoute);

router.get("/me", getCurrentUser);
router.get("/", getAllUsers);
router.get("/messages/:userId", getMessages);

export default router;
