from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.database import engine
from app.core.redis import redis_client
from app.routers import auth, workspaces, workflows, runs, integrations, analytics
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up API...")
    await redis_client.connect()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down API...")
    await redis_client.close()
    await engine.dispose()

@app.get("/health")
async def health_check():
    # redis ping
    redis = await redis_client.get_client()
    await redis.ping()
    return {"status": "ok", "db": "ok", "redis": "ok"}

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
app.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/runs", tags=["runs"])
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
