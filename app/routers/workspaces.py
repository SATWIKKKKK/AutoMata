from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_workspaces():
    return []

@router.post("/")
async def create_workspace():
    return {"id": "1", "name": "New Workspace"}
