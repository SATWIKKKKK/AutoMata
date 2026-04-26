from fastapi import APIRouter

router = APIRouter()

@router.get("/connect/{provider}")
async def connect_integration(provider: str):
    return {"url": f"https://auth.provider.com/{provider}"}

@router.get("/callback")
async def oauth_callback():
    return {"status": "connected"}
