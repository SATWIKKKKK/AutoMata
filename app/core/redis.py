import redis.asyncio as redis
from app.core.config import settings

class RedisClient:
    def __init__(self):
        self.redis = None

    async def connect(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def close(self):
        if self.redis:
            await self.redis.close()

    async def get_client(self):
        if not self.redis:
            await self.connect()
        return self.redis

redis_client = RedisClient()

async def get_redis():
    return await redis_client.get_client()
