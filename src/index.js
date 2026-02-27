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
import { extractClerkAuth } from "./middleware/extractClerkAuth.js";

dotenv.config();

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT;

const httpServer = createServer(app);
initializeSocket(httpServer);

app.use(
	cors({
		origin: "http://localhost:5173",
		credentials: true,
	})
);

app.use(express.json()); // to parse req.body

// ✅ FIXED: Clerk middleware with correct configuration
// The secret key should be in your .env and Clerk reads it automatically
// Just pass the options you need
app.use(extractClerkAuth);

app.use((req, res, next) => {
  console.log("🔍 Debug middleware:", {
    path: req.path,
    hasAuth: !!req.auth,
    userId: req.auth?.userId,
    authHeader: req.headers.authorization ? "present" : "missing"
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
				fs.unlink(path.join(tempDir, file), (err) => {});
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
		message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message 
	});
});

httpServer.listen(PORT, () => {
	console.log("Server is running on port " + PORT);
	connectDB();
});