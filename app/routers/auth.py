from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(req: LoginRequest):
    return {"access_token": "fake-token", "token_type": "bearer"}
    
@router.post("/refresh")
async def refresh():
    return {"access_token": "fake-token", "token_type": "bearer"}
    
@router.post("/logout")
async def logout():
    return {"message": "logged out"}
