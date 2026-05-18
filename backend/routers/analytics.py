from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_current_user, get_supabase, require_role
from models.schemas import HeatmapCell, NineBoxPoint, TeamPulseRow
from services.scoring import (
    calc_ambition_score,
    calc_overall_score,
    calc_score,
    get_nine_box_quadrant,
    get_risk_status,
    predict_q4_score,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

QUARTERS = ["Q1", "Q2", "Q3", "Q4"]


def _compute_goal_scores(goal: dict, actuals: list[dict]) -> dict:
    """Returns scored actuals and quarter->score map for a goal."""
    q_scores: dict[str, float] = {}
    for a in actuals:
        if a["goal_id"] != goal["id"]:
            continue
        s = calc_score(
            goal["uom_type"],
            goal.get("direction"),
            goal["baseline"],
            goal["target"],
            a["actual"],
            goal.get("planned_date"),
            a.get("actual_date"),
        )
        q_scores[a["quarter"]] = s
    return q_scores


@router.get("/heatmap", response_model=list[HeatmapCell])
async def heatmap(
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("admin")),
):
    goals = (
        supabase.table("goals")
        .select("*, users!goals_employee_id_fkey(department_id, departments(name))")
        .eq("status", "approved")
        .execute()
        .data
        or []
    )

    goal_ids = [g["id"] for g in goals]
    actuals = []
    if goal_ids:
        actuals = (
            supabase.table("goal_actuals")
            .select("*")
            .in_("goal_id", goal_ids)
            .execute()
            .data
            or []
        )

    # dept -> quarter -> list of scores
    dept_quarter_scores: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for goal in goals:
        user_data = goal.get("users") or {}
        dept_data = user_data.get("departments") or {}
        dept_name = dept_data.get("name", "Unknown")
        goal_actuals = [a for a in actuals if a["goal_id"] == goal["id"]]
        q_scores = _compute_goal_scores(goal, goal_actuals)
        for q, s in q_scores.items():
            dept_quarter_scores[dept_name][q].append(s)

    cells: list[HeatmapCell] = []
    for dept, q_map in dept_quarter_scores.items():
        for quarter in QUARTERS:
            scores = q_map.get(quarter, [])
            avg = sum(scores) / len(scores) if scores else None
            cells.append(HeatmapCell(department=dept, quarter=quarter, avg_score=avg))  # type: ignore[arg-type]

    return cells


@router.get("/team-pulse", response_model=list[TeamPulseRow])
async def team_pulse(
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("manager", "admin")),
):
    if current_user["role"] == "manager":
        team = (
            supabase.table("users")
            .select("id, full_name")
            .eq("manager_id", current_user["id"])
            .execute()
            .data
            or []
        )
    else:
        team = (
            supabase.table("users")
            .select("id, full_name")
            .eq("role", "employee")
            .execute()
            .data
            or []
        )

    rows: list[TeamPulseRow] = []
    for member in team:
        goals = (
            supabase.table("goals")
            .select("*")
            .eq("employee_id", member["id"])
            .eq("status", "approved")
            .execute()
            .data
            or []
        )

        if not goals:
            rows.append(
                TeamPulseRow(
                    employee_id=member["id"],
                    employee_name=member["full_name"],
                    goal_count=0,
                )
            )
            continue

        goal_ids = [g["id"] for g in goals]
        actuals = (
            supabase.table("goal_actuals")
            .select("*")
            .in_("goal_id", goal_ids)
            .execute()
            .data
            or []
        )

        scored_goals = []
        all_q1: list[float] = []
        all_q2: list[float] = []

        for goal in goals:
            goal_actuals = [a for a in actuals if a["goal_id"] == goal["id"]]
            q_scores = _compute_goal_scores(goal, goal_actuals)
            latest = list(q_scores.values())[-1] if q_scores else None
            scored_goals.append({"score": latest or 0, "weightage": goal["weightage"]})
            if "Q1" in q_scores:
                all_q1.append(q_scores["Q1"])
            if "Q2" in q_scores:
                all_q2.append(q_scores["Q2"])

        overall = calc_overall_score(scored_goals)
        avg_q1 = sum(all_q1) / len(all_q1) if all_q1 else None
        avg_q2 = sum(all_q2) / len(all_q2) if all_q2 else None
        predicted = predict_q4_score(avg_q1, avg_q2)
        risk = get_risk_status(predicted)

        rows.append(
            TeamPulseRow(
                employee_id=member["id"],
                employee_name=member["full_name"],
                overall_score=overall,
                predicted_q4=predicted,
                risk_status=risk,  # type: ignore[arg-type]
                goal_count=len(goals),
            )
        )

    rows.sort(key=lambda r: (r.overall_score or 0))
    return rows


@router.get("/nine-box", response_model=list[NineBoxPoint])
async def nine_box(
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("admin")),
):
    employees = (
        supabase.table("users")
        .select("id, full_name")
        .eq("role", "employee")
        .execute()
        .data
        or []
    )

    points: list[NineBoxPoint] = []
    for emp in employees:
        goals = (
            supabase.table("goals")
            .select("*")
            .eq("employee_id", emp["id"])
            .eq("status", "approved")
            .execute()
            .data
            or []
        )
        if not goals:
            continue

        goal_ids = [g["id"] for g in goals]
        actuals = (
            supabase.table("goal_actuals")
            .select("*")
            .in_("goal_id", goal_ids)
            .execute()
            .data
            or []
        )

        scored_goals = []
        ambition_scores = []
        for goal in goals:
            goal_actuals = [a for a in actuals if a["goal_id"] == goal["id"]]
            q_scores = _compute_goal_scores(goal, goal_actuals)
            latest = list(q_scores.values())[-1] if q_scores else 0
            scored_goals.append({"score": latest, "weightage": goal["weightage"]})
            ambition_scores.append(calc_ambition_score(goal["uom_type"], goal["baseline"], goal["target"]))

        performance = calc_overall_score(scored_goals)
        ambition = sum(ambition_scores) / len(ambition_scores) if ambition_scores else 0
        quadrant = get_nine_box_quadrant(performance, ambition)

        points.append(
            NineBoxPoint(
                employee_id=emp["id"],
                employee_name=emp["full_name"],
                performance=performance,
                ambition=ambition,
                quadrant=quadrant,
            )
        )

    return points
