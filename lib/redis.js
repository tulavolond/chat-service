import Redis from 'ioredis';

// Два соединения: одно для pub, другое для sub (ioredis требует этого для режима subscribe)
export const redisPub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
export const redisSub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const CHAT_CHANNEL = 'chat:messages';