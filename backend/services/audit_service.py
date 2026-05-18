from typing import Any, Optional


class AuditAction:
    GOAL_CREATE = "goal_create"
    GOAL_UPDATE = "goal_update"
    GOAL_SUBMIT = "goal_submit"
    GOAL_APPROVE = "goal_approve"
    GOAL_REJECT = "goal_reject"
    GOAL_OVERRIDE = "goal_override"
    CHECKIN_SAVE = "checkin_save"
    EXPORT_CSV = "export_csv"
    EXPORT_EXCEL = "export_excel"


async def write_audit(
    supabase,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    before_state: Optional[dict] = None,
    after_state: Optional[dict] = None,
) -> None:
    payload: dict[str, Any] = {
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
    }
    if entity_id:
        payload["entity_id"] = entity_id
    if before_state is not None:
        payload["before_state"] = before_state
    if after_state is not None:
        payload["after_state"] = after_state

    supabase.table("audit_logs").insert(payload).execute()
