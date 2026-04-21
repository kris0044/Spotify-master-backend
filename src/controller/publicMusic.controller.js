import YTMusic from "ytmusic-api";
import { Song } from "../models/song.model.js";

let ytMusicClientPromise = null;

const getYTMusicClient = async () => {
	if (!ytMusicClientPromise) {
		ytMusicClientPromise = (async () => {
			const client = new YTMusic();
			await client.initialize();
			return client;
		})();
	}

	return ytMusicClientPromise;
};

const mapPublicMusicSong = (song, rank = null, internalSongId = null) => ({
	videoId: song.videoId,
	title: song.name,
	artist: song.artist?.name || "Unknown artist",
	album: song.album?.name || null,
	duration: song.duration ?? null,
	thumbnailUrl: song.thumbnails?.at(-1)?.url || song.thumbnails?.[0]?.url || "",
	rank,
	internalSongId,
});

const mapPublicMusicAlbum = (album, songs = [], trackCount = songs.length) => ({
	albumId: album.albumId,
	title: album.name,
	artist: album.artist?.name || "Unknown artist",
	releaseYear: album.year ?? 0,
	imageUrl: album.thumbnails?.at(-1)?.url || album.thumbnails?.[0]?.url || "",
	trackCount: trackCount || 0,
	songs,
});

const attachInternalSongIds = async (songs) => {
	const videoIds = songs.map((song) => song.videoId).filter(Boolean);
	const existingSongs = await Song.find({ externalVideoId: { $in: videoIds } }).select("_id externalVideoId").lean();
	const songIdByVideoId = new Map(existingSongs.map((song) => [song.externalVideoId, String(song._id)]));

	return songs.map((song) => mapPublicMusicSong(song, null, songIdByVideoId.get(song.videoId) || null));
};

export const searchPublicMusic = async (req, res, next) => {
	try {
		const query = String(req.query.q || "").trim();

		if (!query) {
			return res.status(400).json({ message: "Search query is required" });
		}

		const client = await getYTMusicClient();
		const songs = await client.searchSongs(query);
		const mappedSongs = await attachInternalSongIds(songs.slice(0, 20));

		res.status(200).json({
			songs: mappedSongs,
		});
	} catch (error) {
		next(error);
	}
};

const buildChartQueries = (scope, region) => {
	if (scope === "global") {
		return ["Top 100 Global", "Top 100 Songs Global", "Global Top 100"];
	}

	const safeRegion = region?.trim() || "India";
	return [`${safeRegion} Top 100`, `${safeRegion} Top 100 Songs`, `Top 100 ${safeRegion}`];
};

export const getPublicMusicCharts = async (req, res, next) => {
	try {
		const scope = req.query.scope === "global" ? "global" : "region";
		const region = String(req.query.region || "India").trim();
		const client = await getYTMusicClient();
		const queries = buildChartQueries(scope, region);

		let selectedPlaylist = null;
		let selectedQuery = "";
		let videos = [];

		for (const query of queries) {
			const playlists = await client.searchPlaylists(query);

			for (const playlist of playlists.slice(0, 5)) {
				try {
					const playlistVideos = await client.getPlaylistVideos(playlist.playlistId);

					if (playlistVideos.length > videos.length) {
						selectedPlaylist = playlist;
						selectedQuery = query;
						videos = playlistVideos;
					}

					if (playlistVideos.length >= 50) {
						selectedPlaylist = playlist;
						selectedQuery = query;
						videos = playlistVideos;
						break;
					}
				} catch (playlistError) {
					console.error("Failed to fetch playlist videos", playlist.playlistId, playlistError?.message);
				}
			}

			if (videos.length >= 50) {
				break;
			}
		}

		if (!selectedPlaylist || videos.length === 0) {
			return res.status(404).json({ message: "Top chart playlist not found" });
		}

		const topVideos = videos.slice(0, 100);
		const existingSongs = await Song.find({ externalVideoId: { $in: topVideos.map((song) => song.videoId) } })
			.select("_id externalVideoId")
			.lean();
		const songIdByVideoId = new Map(existingSongs.map((song) => [song.externalVideoId, String(song._id)]));

		res.status(200).json({
			scope,
			region: scope === "global" ? null : region,
			sourceQuery: selectedQuery,
			playlist: {
				name: selectedPlaylist.name,
				playlistId: selectedPlaylist.playlistId,
				artist: selectedPlaylist.artist?.name || "YouTube Music",
				thumbnailUrl: selectedPlaylist.thumbnails?.at(-1)?.url || selectedPlaylist.thumbnails?.[0]?.url || "",
			},
			songs: topVideos.map((song, index) => mapPublicMusicSong(song, index + 1, songIdByVideoId.get(song.videoId) || null)),
		});
	} catch (error) {
		next(error);
	}
};

export const searchPublicMusicAlbums = async (req, res, next) => {
	try {
		const query = String(req.query.q || "").trim();
		const limit = Math.max(1, Math.min(Number(req.query.limit) || 12, 20));

		if (!query) {
			return res.status(400).json({ message: "Search query is required" });
		}

		const client = await getYTMusicClient();
		const albums = await client.searchAlbums(query);
		const selectedAlbums = albums.slice(0, limit);
		const detailedAlbums = await Promise.allSettled(
			selectedAlbums.map((album) => client.getAlbum(album.albumId))
		);
		const detailedAlbumById = new Map(
			detailedAlbums
				.map((result, index) =>
					result.status === "fulfilled"
						? [selectedAlbums[index].albumId, result.value]
						: null
				)
				.filter(Boolean)
		);
		const mappedAlbums = selectedAlbums.map((album) => {
			const detailedAlbum = detailedAlbumById.get(album.albumId);
			return mapPublicMusicAlbum(album, [], detailedAlbum?.songs?.length || 0);
		});

		res.status(200).json({
			albums: mappedAlbums,
		});
	} catch (error) {
		next(error);
	}
};

export const getPublicMusicAlbum = async (req, res, next) => {
	try {
		const albumId = String(req.params.albumId || "").trim();

		if (!albumId) {
			return res.status(400).json({ message: "Album ID is required" });
		}

		const client = await getYTMusicClient();
		const album = await client.getAlbum(albumId);
		const songs = await attachInternalSongIds(album.songs || []);

		res.status(200).json(mapPublicMusicAlbum(album, songs));
	} catch (error) {
		next(error);
	}
};

export const resolvePublicMusicSong = async (req, res, next) => {
	try {
		const { videoId, title, artist, album, duration, thumbnailUrl } = req.body;

		if (!videoId || !title || !artist || !thumbnailUrl) {
			return res.status(400).json({ message: "videoId, title, artist, and thumbnailUrl are required" });
		}

		const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

		const song = await Song.findOneAndUpdate(
			{ externalVideoId: videoId },
			{
				$set: {
					title,
					artist,
					genre: "Public Music",
					imageUrl: thumbnailUrl,
					audioUrl: watchUrl,
					playbackUrl: watchUrl,
					duration: Number(duration) || 0,
					source: "youtube_music",
					externalVideoId: videoId,
					isApproved: true,
				},
				$setOnInsert: {
					albumId: null,
					playCount: 0,
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);

		res.status(200).json(song);
	} catch (error) {
		next(error);
	}
};
