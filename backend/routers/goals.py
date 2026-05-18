from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import get_current_user, get_supabase, require_role
from models.schemas import ActualOut, ActualUpsert, GoalCreate, GoalOut, MessageResponse, OverrideRequest
from services.audit_service import AuditAction, write_audit
from services.scoring import (
    calc_score,
    calc_overall_score,
    get_risk_status,
    predict_q4_score,
    validate_weightage,
)

router = APIRouter(prefix="/goals", tags=["goals"])


def _enrich_goal(goal: dict, supabase: Client) -> dict:
    actuals = (
        supabase.table("goal_actuals")
        .select("*")
        .eq("goal_id", goal["id"])
        .order("quarter")
        .execute()
        .data
        or []
    )

    scores = []
    for a in actuals:
        s = calc_score(
            goal["uom_type"],
            goal.get("direction"),
            goal["baseline"],
            goal["target"],
            a["actual"],
            goal.get("planned_date"),
            a.get("actual_date"),
        )
        a["score"] = s
        scores.append(s)

    latest_score = scores[-1] if scores else None
    q_scores = {a["quarter"]: a["score"] for a in actuals}
    predicted = predict_q4_score(q_scores.get("Q1"), q_scores.get("Q2"))

    goal["latest_score"] = latest_score
    goal["predicted_q4"] = predicted
    goal["risk_status"] = get_risk_status(predicted)
    return goal


@router.get("/", response_model=list[GoalOut])
async def list_goals(
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    role = current_user["role"]
    query = supabase.table("goals").select(
        "*, users!goals_employee_id_fkey(full_name, departments(name))"
    )

    if role == "employee":
        query = query.eq("employee_id", current_user["id"])
    elif role == "manager":
        query = query.eq("users.manager_id", current_user["id"])

    result = query.execute()
    goals = result.data or []

    enriched = []
    for g in goals:
        user_data = g.pop("users", {}) or {}
        dept_data = user_data.pop("departments", {}) or {}
        g["employee_name"] = user_data.get("full_name")
        g["department_name"] = dept_data.get("name") if dept_data else None
        enriched.append(_enrich_goal(g, supabase))

    return enriched


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(
    goal_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    result = (
        supabase.table("goals")
        .select("*, users!goals_employee_id_fkey(full_name, departments(name))")
        .eq("id", goal_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    g = result.data
    user_data = g.pop("users", {}) or {}
    dept_data = user_data.pop("departments", {}) or {}
    g["employee_name"] = user_data.get("full_name")
    g["department_name"] = dept_data.get("name") if dept_data else None

    role = current_user["role"]
    if role == "employee" and g["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return _enrich_goal(g, supabase)


@router.post("/", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("employee")),
):
    payload = body.model_dump()
    payload["employee_id"] = current_user["id"]
    payload["status"] = "draft"
    payload["locked"] = False

    if isinstance(payload.get("planned_date"), date):
        payload["planned_date"] = payload["planned_date"].isoformat()

    result = supabase.table("goals").insert(payload).execute()
    goal = result.data[0]

    await write_audit(
        supabase,
        current_user["id"],
        AuditAction.GOAL_CREATE,
        "goal",
        goal["id"],
        after_state=goal,
    )

    goal["employee_name"] = current_user.get("full_name")
    goal["department_name"] = None
    return _enrich_goal(goal, supabase)


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: str,
    body: dict,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("employee")),
):
    existing = (
        supabase.table("goals").select("*").eq("id", goal_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal = existing.data
    if goal["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if goal["status"] not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Only draft or rejected goals can be edited")
    if goal.get("locked"):
        raise HTTPException(status_code=400, detail="Goal is locked")

    if "planned_date" in body and isinstance(body["planned_date"], date):
        body["planned_date"] = body["planned_date"].isoformat()

    result = supabase.table("goals").update(body).eq("id", goal_id).execute()
    updated = result.data[0]

    await write_audit(
        supabase,
        current_user["id"],
        AuditAction.GOAL_UPDATE,
        "goal",
        goal_id,
        before_state=goal,
        after_state=updated,
    )

    updated["employee_name"] = current_user.get("full_name")
    updated["department_name"] = None
    return _enrich_goal(updated, supabase)


@router.post("/{goal_id}/submit", response_model=MessageResponse)
async def submit_goal(
    goal_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("employee")),
):
    existing = (
        supabase.table("goals").select("*").eq("id", goal_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal = existing.data
    if goal["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if goal["status"] != "draft" and goal["status"] != "rejected":
        raise HTTPException(status_code=400, detail="Goal cannot be submitted in current state")

    # validate total weightage across non-rejected goals
    all_goals = (
        supabase.table("goals")
        .select("weightage, status")
        .eq("employee_id", current_user["id"])
        .neq("status", "rejected")
        .execute()
        .data
        or []
    )
    # include the current goal with its current weightage
    weightages = [g["weightage"] for g in all_goals]
    check = validate_weightage(weightages)
    if not check["valid"]:
        raise HTTPException(status_code=400, detail=check["message"])

    supabase.table("goals").update({"status": "submitted"}).eq("id", goal_id).execute()

    await write_audit(
        supabase,
        current_user["id"],
        AuditAction.GOAL_SUBMIT,
        "goal",
        goal_id,
    )

    return {"message": "Goal submitted for approval"}


@router.post("/{goal_id}/override", response_model=MessageResponse)
async def override_goal(
    goal_id: str,
    body: OverrideRequest,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("admin")),
):
    existing = (
        supabase.table("goals").select("*").eq("id", goal_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    supabase.table("goals").update({"locked": False, "status": "draft"}).eq("id", goal_id).execute()

    await write_audit(
        supabase,
        current_user["id"],
        AuditAction.GOAL_OVERRIDE,
        "goal",
        goal_id,
        after_state={"reason": body.reason},
    )

    return {"message": "Goal unlocked successfully"}


@router.get("/{goal_id}/actuals", response_model=list[ActualOut])
async def get_actuals(
    goal_id: str,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    goal_res = supabase.table("goals").select("*").eq("id", goal_id).single().execute()
    if not goal_res.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal = goal_res.data
    role = current_user["role"]
    if role == "employee" and goal["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    actuals = (
        supabase.table("goal_actuals")
        .select("*")
        .eq("goal_id", goal_id)
        .order("quarter")
        .execute()
        .data
        or []
    )

    for a in actuals:
        a["score"] = calc_score(
            goal["uom_type"],
            goal.get("direction"),
            goal["baseline"],
            goal["target"],
            a["actual"],
            goal.get("planned_date"),
            a.get("actual_date"),
        )

    return actuals


@router.put("/{goal_id}/actuals", response_model=ActualOut)
async def upsert_actual(
    goal_id: str,
    body: ActualUpsert,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(get_current_user),
):
    goal_res = supabase.table("goals").select("*").eq("id", goal_id).single().execute()
    if not goal_res.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal = goal_res.data
    role = current_user["role"]
    if role == "employee" and goal["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    payload = body.model_dump()
    payload["goal_id"] = goal_id
    if isinstance(payload.get("actual_date"), date):
        payload["actual_date"] = payload["actual_date"].isoformat()

    existing = (
        supabase.table("goal_actuals")
        .select("id")
        .eq("goal_id", goal_id)
        .eq("quarter", body.quarter)
        .maybe_single()
        .execute()
    )

    if existing.data:
        result = (
            supabase.table("goal_actuals")
            .update(payload)
            .eq("id", existing.data["id"])
            .execute()
        )
    else:
        result = supabase.table("goal_actuals").insert(payload).execute()

    actual = result.data[0]
    actual["score"] = calc_score(
        goal["uom_type"],
        goal.get("direction"),
        goal["baseline"],
        goal["target"],
        actual["actual"],
        goal.get("planned_date"),
        actual.get("actual_date"),
    )

    await write_audit(
        supabase,
        current_user["id"],
        AuditAction.CHECKIN_SAVE,
        "goal_actual",
        actual["id"],
        after_state=actual,
    )

    return actual
