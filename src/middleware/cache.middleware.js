import { getCache, invalidateCacheByPrefixes, setCache } from "../lib/cache.js";

const buildUserScope = (req) => {
	const role = req.user?.role || "guest";
	const userId = req.auth?.userId || "anonymous";
	return `${role}:${userId}`;
};

export const createCacheMiddleware = ({ keyPrefix, ttlSeconds }) => {
	return async (req, res, next) => {
		try {
			if (req.method !== "GET") return next();

			const cacheKey = `${keyPrefix}:${buildUserScope(req)}:${req.originalUrl}`;
			const cached = await getCache(cacheKey);
			if (cached !== null) {
				return res.status(200).json(cached);
			}

			const originalJson = res.json.bind(res);
			res.json = (body) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					void setCache(cacheKey, body, ttlSeconds);
				}
				return originalJson(body);
			};

			next();
		} catch (error) {
			next(error);
		}
	};
};

export const createInvalidationMiddleware = (prefixes = []) => {
	return (req, res, next) => {
		const originalJson = res.json.bind(res);
		res.json = (body) => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				void invalidateCacheByPrefixes(prefixes);
			}
			return originalJson(body);
		};
		next();
	};
};
