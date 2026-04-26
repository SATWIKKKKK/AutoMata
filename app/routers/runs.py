import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from app.core.security import get_current_user, TokenPayload
from app.core.redis import redis_client

router = APIRouter()

@router.get("/{run_id}/logs")
async def stream_run_logs(run_id: str, request: Request, current_user: TokenPayload = Depends(get_current_user)):
    # Check if run belongs to workspace (simulated via DB or just assuming verified for now)
    
    async def event_generator():
        redis = await redis_client.get_client()
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"run:{run_id}:updates")
        
        try:
            while True:
                if await request.is_disconnected():
                    break
                    
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message is not None:
                    data = message['data']
                    yield {"data": data}
                    
                    parsed = json.loads(data)
                    if parsed.get("status") in ["run_complete", "run_failed"]:
                        break
                else:
                    # Heartbeat every 15 seconds
                    yield {"data": json.dumps({"event": "heartbeat", "run_id": run_id})}
                    
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(f"run:{run_id}:updates")

    return EventSourceResponse(event_generator())
