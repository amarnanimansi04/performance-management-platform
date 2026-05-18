from typing import Optional

from fastapi import APIRouter, Depends, Query
from supabase import Client

from dependencies import get_supabase, require_role
from models.schemas import AuditOut

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("/", response_model=list[AuditOut])
async def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    supabase: Client = Depends(get_supabase),
    current_user: dict = Depends(require_role("admin")),
):
    offset = (page - 1) * page_size

    query = supabase.table("audit_logs").select(
        "*, users!audit_logs_actor_id_fkey(full_name)"
    )

    if action:
        query = query.eq("action", action)
    if entity_type:
        query = query.eq("entity_type", entity_type)
    if actor_id:
        query = query.eq("actor_id", actor_id)

    result = (
        query.order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    rows = result.data or []
    out = []
    for row in rows:
        user_data = row.pop("users", {}) or {}
        row["actor_name"] = user_data.get("full_name")
        out.append(row)

    return out
