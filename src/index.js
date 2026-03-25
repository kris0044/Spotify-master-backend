import express from "express";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import fileUpload from "express-fileupload";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import cron from "node-cron";

import { initializeSocket } from "./lib/socket.js";

import { connectDB } from "./lib/db.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import songRoutes from "./routes/song.route.js";
import albumRoutes from "./routes/album.route.js";
import statRoutes from "./routes/stat.route.js";
import playlistRoutes from "./routes/playlist.route.js";
import favoriteRoutes from "./routes/favorite.route.js";
import artistRoutes from "./routes/artist.route.js";
import historyRoutes from "./routes/history.route.js";
import recommendationRoutes from "./routes/recommendation.route.js";
import followRoutes from "./routes/follow.route.js";
import feedbackRoutes from "./routes/feedback.route.js";
import publicMusicRoutes from "./routes/publicMusic.route.js";
import { extractClerkAuth } from "./middleware/extractClerkAuth.js";

dotenv.config();

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT;
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || "http://localhost:5173,http://127.0.0.1:5173")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

const httpServer = createServer(app);
initializeSocket(httpServer);

app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);

app.use(express.json());

app.use(
	clerkMiddleware({
		secretKey: process.env.CLERK_SECRET_KEY,
		authorizedParties,
	})
);

app.use(extractClerkAuth);

app.use((req, res, next) => {
	console.log("Debug middleware:", {
		path: req.path,
		hasAuth: !!req.auth,
		userId: req.auth?.userId,
		authHeader: req.headers.authorization ? "present" : "missing",
	});
	next();
});

app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: path.join(__dirname, "tmp"),
		createParentPath: true,
		limits: {
			fileSize: 10 * 1024 * 1024, // 10MB max file size
		},
	})
);

// cron jobs
const tempDir = path.join(process.cwd(), "tmp");
cron.schedule("0 * * * *", () => {
	if (fs.existsSync(tempDir)) {
		fs.readdir(tempDir, (err, files) => {
			if (err) {
				console.log("error", err);
				return;
			}
			for (const file of files) {
				fs.unlink(path.join(tempDir, file), () => {});
			}
		});
	}
});

app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/stats", statRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/artist", artistRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api", followRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/publicmusic", publicMusicRoutes);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "../frontend/dist")));
	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"));
	});
}

// error handler
app.use((err, req, res, next) => {
	// Handle Clerk authentication errors gracefully for /admin/check endpoint
	if (req.path === "/api/admin/check" && (err.status === 401 || err.message?.includes("Unauthorized"))) {
		return res.status(200).json({ admin: false });
	}

	res.status(err.status || 500).json({
		message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
	});
});

httpServer.listen(PORT, () => {
	console.log("Server is running on port " + PORT);
	connectDB();
});
