from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from dependencies import get_current_user, get_supabase, require_role
from models.schemas import ApprovalCreate, ApprovalOut
from services.audit_service import AuditAction, write_audit

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("/")
async def list_pending(
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("manager", "admin")),
):
    role = current_user["role"]

    if role == "manager":
        team_result = (
            supabase.table("users")
            .select("id")
            .eq("manager_id", current_user["id"])
            .execute()
        )
        team_ids = [u["id"] for u in (team_result.data or [])]

        if not team_ids:
            return []

        result = (
            supabase.table("goals")
            .select("id, title, status, employee_id, users!goals_employee_id_fkey(full_name)")
            .eq("status", "submitted")
            .in_("employee_id", team_ids)
            .execute()
        )
    else:
        result = (
            supabase.table("goals")
            .select("id, title, status, employee_id, users!goals_employee_id_fkey(full_name)")
            .eq("status", "submitted")
            .execute()
        )

    rows = result.data or []
    out = []
    for g in rows:
        user_data = g.pop("users", {}) or {}
        g["employee_name"] = user_data.get("full_name")
        out.append(g)

    return out


@router.post("/", response_model=ApprovalOut)
async def create_approval(
    body: ApprovalCreate,
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("manager", "admin")),
):
    goal_res = (
        supabase.table("goals")
        .select("*")
        .eq("id", body.goal_id)
        .single()
        .execute()
    )
    if not goal_res.data:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal = goal_res.data
    if goal["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Goal is not in submitted state")

    new_status = body.decision
    supabase.table("goals").update(
        {"status": new_status, "locked": new_status == "approved"}
    ).eq("id", body.goal_id).execute()

    approval_payload = {
        "goal_id": body.goal_id,
        "approver_id": current_user["id"],
        "decision": body.decision,
        "reason": body.reason,
        "comment": body.comment,
    }
    result = supabase.table("approvals").insert(approval_payload).execute()
    approval = result.data[0]

    action = AuditAction.GOAL_APPROVE if body.decision == "approved" else AuditAction.GOAL_REJECT
    await write_audit(
        supabase,
        current_user["id"],
        action,
        "goal",
        body.goal_id,
        before_state={"status": "submitted"},
        after_state={"status": new_status, "reason": body.reason},
    )

    return approval
