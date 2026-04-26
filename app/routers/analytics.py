from fastapi import APIRouter

router = APIRouter()

@router.get("/runs")
async def get_analytics_runs():
    return []

@router.get("/costs")
async def get_analytics_costs():
    return {"total_cost": 0.0}
