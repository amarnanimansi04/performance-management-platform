from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_current_user, get_supabase
from models.schemas import GoalScoreRequest, GoalScoreResponse
from services.ai_service import score_goal_quality

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/score-goal", response_model=GoalScoreResponse)
async def score_goal(
    body: GoalScoreRequest,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    result = await score_goal_quality(body.goal_text, supabase, body.goal_id)
    return result
