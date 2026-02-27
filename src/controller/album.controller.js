import { Album } from "../models/album.model.js";
import { Song } from "../models/song.model.js";

export const getAllAlbums = async (req, res, next) => {
	try {
		// Only show approved albums to regular users
		const filter = req.user?.role === "admin" ? {} : { isApproved: true };
		const albums = await Album.find(filter).sort({ createdAt: -1 });
		res.status(200).json(albums);
	} catch (error) {
		next(error);
	}
};

export const getAlbumById = async (req, res, next) => {
	try {
		const { albumId } = req.params;
		const filter = req.user?.role === "admin" ? {} : { isApproved: true };

		const album = await Album.findOne({ _id: albumId, ...filter }).populate({
			path: "songs",
			match: req.user?.role === "admin" ? {} : { isApproved: true },
		});

		if (!album) {
			return res.status(404).json({ message: "Album not found" });
		}

		res.status(200).json(album);
	} catch (error) {
		next(error);
	}
};
