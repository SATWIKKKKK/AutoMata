from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_workflows():
    return []

@router.post("/")
async def create_workflow():
    return {"id": "1", "name": "New Workflow"}

@router.post("/{id}/activate")
async def activate_workflow(id: str):
    return {"status": "active"}
