import Redis from "ioredis";

const DEFAULT_TTL_SECONDS = 60;

let redis = null;

if (process.env.REDIS_URL) {
	redis = new Redis(process.env.REDIS_URL, {
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
	});

	redis.on("error", (error) => {
		console.error("Redis error:", error.message);
	});
}

const serialize = (value) => JSON.stringify(value);

const deserialize = (value) => {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

export const getCache = async (key) => {
	if (!redis) return null;
	const data = await redis.get(key);
	return data ? deserialize(data) : null;
};

export const setCache = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
	if (!redis) return;
	await redis.set(key, serialize(value), "EX", Math.max(1, ttlSeconds));
};

export const invalidateCacheByPrefixes = async (prefixes = []) => {
	if (!redis || !prefixes.length) return;

	for (const prefix of prefixes) {
		let cursor = "0";
		do {
			const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
			cursor = nextCursor;
			if (keys.length) {
				await redis.del(...keys);
			}
		} while (cursor !== "0");
	}
};
