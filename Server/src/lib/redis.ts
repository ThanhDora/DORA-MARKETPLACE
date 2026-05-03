import * as IORedis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';

let redis: RedisType | null = null;

export const initRedis = (): RedisType | null => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RedisCtor = (IORedis as any).default || IORedis;
    redis = new RedisCtor(redisUrl);

    redis.on('connect', () => {
      console.log('[INFO] Redis connected');
    });

    redis.on('error', (err: any) => {
      console.error('[ERROR] Redis error:', err.message);
    });

    redis.on('ready', () => {
      console.log('[INFO] Redis ready');
    });

    return redis;
  } catch (error) {
    console.error('[WARN] Redis initialization failed:', error);
    return null;
  }
};

export const getRedis = (): any => redis;

export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redis) return null;
  return redis.get(key);
};

export const cacheSet = async (key: string, value: string, expireInSeconds: number = 3600): Promise<void> => {
  if (!redis) return;
  await redis.setex(key, expireInSeconds, value);
};

export const cacheDelete = async (key: string): Promise<void> => {
  if (!redis) return;
  await redis.del(key);
};

export const cacheClear = async (pattern: string): Promise<void> => {
  if (!redis) return;
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = result[0];
    const keys = result[1];
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
};

redis = initRedis();
