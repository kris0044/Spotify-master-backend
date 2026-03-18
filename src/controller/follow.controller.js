import mongoose from "mongoose";
import { Follow } from "../models/follow.model.js";
import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";

const MODEL_VALUES = new Set(["Song", "Artist", "User"]);

const getCurrentUser = async (clerkId) => User.findOne({ clerkId });

const buildTargetPayload = (doc, model) => {
	if (!doc) return null;
	if (model === "Song") {
		return {
			_id: doc._id,
			title: doc.title,
			artist: doc.artist,
			imageUrl: doc.imageUrl,
			audioUrl: doc.audioUrl,
			isApproved: doc.isApproved,
		};
	}

	return {
		_id: doc._id,
		fullName: doc.fullName,
		imageUrl: doc.imageUrl,
		role: doc.role,
		clerkId: doc.clerkId,
	};
};

export const followTarget = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		const { followingId, followingModel } = req.body;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}
		if (!followingId || !followingModel || !MODEL_VALUES.has(followingModel)) {
			return res.status(400).json({ message: "followingId and valid followingModel are required" });
		}
		if (!mongoose.Types.ObjectId.isValid(followingId)) {
			return res.status(400).json({ message: "Invalid followingId" });
		}

		const currentUser = await getCurrentUser(userId);
		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		if ((followingModel === "Artist" || followingModel === "User") && currentUser._id.equals(followingId)) {
			return res.status(400).json({ message: "You cannot follow yourself" });
		}

		const normalizedFollowingId = new mongoose.Types.ObjectId(followingId);
		if (followingModel === "Song") {
			const song = await Song.findById(normalizedFollowingId).select("_id");
			if (!song) return res.status(404).json({ message: "Song not found" });
		}
		if (followingModel === "Artist") {
			const artist = await User.findOne({ _id: normalizedFollowingId, role: "artist" }).select("_id");
			if (!artist) return res.status(404).json({ message: "Artist not found" });
		}
		if (followingModel === "User") {
			const targetUser = await User.findById(normalizedFollowingId).select("_id");
			if (!targetUser) return res.status(404).json({ message: "User not found" });
		}

		const follow = await Follow.findOneAndUpdate(
			{
				followerId: currentUser._id,
				followingId: normalizedFollowingId,
				followingModel,
			},
			{
				$setOnInsert: {
					followerId: currentUser._id,
					followingId: normalizedFollowingId,
					followingModel,
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);

		res.status(201).json(follow);
	} catch (error) {
		next(error);
	}
};

export const unfollowTarget = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		const { followingId, followingModel } = req.body;

		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}
		if (!followingId || !followingModel || !MODEL_VALUES.has(followingModel)) {
			return res.status(400).json({ message: "followingId and valid followingModel are required" });
		}
		if (!mongoose.Types.ObjectId.isValid(followingId)) {
			return res.status(400).json({ message: "Invalid followingId" });
		}

		const currentUser = await getCurrentUser(userId);
		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		await Follow.findOneAndDelete({
			followerId: currentUser._id,
			followingId: new mongoose.Types.ObjectId(followingId),
			followingModel,
		});

		res.status(200).json({ message: "Unfollowed successfully" });
	} catch (error) {
		next(error);
	}
};

export const getFollowing = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const currentUser = await getCurrentUser(userId);
		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const follows = await Follow.find({ followerId: currentUser._id }).sort({ createdAt: -1 }).lean();
		const songIds = follows
			.filter((item) => item.followingModel === "Song")
			.map((item) => item.followingId);
		const profileIds = follows
			.filter((item) => item.followingModel !== "Song")
			.map((item) => item.followingId);

		const [songs, profiles] = await Promise.all([
			Song.find({ _id: { $in: songIds } })
				.select("title artist imageUrl audioUrl isApproved")
				.lean(),
			User.find({ _id: { $in: profileIds } })
				.select("fullName imageUrl role clerkId")
				.lean(),
		]);

		const songMap = new Map(songs.map((item) => [String(item._id), item]));
		const profileMap = new Map(profiles.map((item) => [String(item._id), item]));

		const following = follows
			.map((item) => {
				const key = String(item.followingId);
				const target = item.followingModel === "Song" ? songMap.get(key) : profileMap.get(key);
				if (!target) return null;
				return {
					_id: item._id,
					followingModel: item.followingModel,
					following: buildTargetPayload(target, item.followingModel),
					createdAt: item.createdAt,
				};
			})
			.filter(Boolean);

		res.status(200).json(following);
	} catch (error) {
		next(error);
	}
};

export const getFollowers = async (req, res, next) => {
	try {
		const userId = req.auth?.userId;
		if (!userId) {
			return res.status(401).json({ message: "Unauthorized - you must be logged in" });
		}

		const currentUser = await getCurrentUser(userId);
		if (!currentUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const followers = await Follow.find({
			followingId: currentUser._id,
			followingModel: { $in: ["Artist", "User"] },
		})
			.populate("followerId", "fullName imageUrl role clerkId")
			.sort({ createdAt: -1 });

		res.status(200).json(
			followers
				.filter((item) => item.followerId)
				.map((item) => ({
					_id: item._id,
					followingModel: item.followingModel,
					follower: {
						_id: item.followerId._id,
						fullName: item.followerId.fullName,
						imageUrl: item.followerId.imageUrl,
						role: item.followerId.role,
						clerkId: item.followerId.clerkId,
					},
					createdAt: item.createdAt,
				}))
		);
	} catch (error) {
		next(error);
	}
};
