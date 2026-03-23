import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
	getCurrentUser,
	getAllUsers,
	getMessages,
	getMyNotifications,
	markNotificationRead,
	toggleNewsletterSubscription,
	getMyQueue,
	addSongToQueue,
	removeSongFromQueue,
	clearMyQueue,
	consumeNextQueuedSong,
} from "../controller/user.controller.js";
const router = Router();

router.use(protectRoute);

router.get("/me", getCurrentUser);
router.post("/me/newsletter", toggleNewsletterSubscription);
router.get("/me/notifications", getMyNotifications);
router.post("/me/notifications/:id/read", markNotificationRead);
router.get("/me/queue", getMyQueue);
router.post("/me/queue", addSongToQueue);
router.post("/me/queue/consume", consumeNextQueuedSong);
router.delete("/me/queue", clearMyQueue);
router.delete("/me/queue/:songId", removeSongFromQueue);
router.get("/", getAllUsers);
router.get("/messages/:userId", getMessages);

export default router;
