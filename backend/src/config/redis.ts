import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  if (env.NODE_ENV !== 'test') {
    console.log('[redis] Connected');
  }
});

redis.on('error', (err) => {
  console.error('[redis] Connection error:', err);
});

export async function closeRedis(): Promise<void> {
  await redis.quit();
  console.log('[redis] Connection closed');
}
