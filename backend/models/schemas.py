from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator

Role = Literal["employee", "manager", "admin"]
UoMType = Literal["numeric", "percent", "timeline", "zero_based"]
Direction = Literal["higher", "lower"]
GoalStatus = Literal["draft", "submitted", "approved", "rejected"]
Quarter = Literal["Q1", "Q2", "Q3", "Q4"]
RiskStatus = Literal["on_track", "at_risk", "behind"]


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: Role
    department_id: Optional[str] = None


class UserProfile(BaseModel):
    id: str
    full_name: str
    email: str
    role: Role
    department_id: Optional[str] = None
    department_name: Optional[str] = None


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    uom_type: UoMType
    direction: Optional[Direction] = None
    baseline: float
    target: float
    planned_date: date
    weightage: float
    parent_goal_id: Optional[str] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    uom_type: Optional[UoMType] = None
    direction: Optional[Direction] = None
    baseline: Optional[float] = None
    target: Optional[float] = None
    planned_date: Optional[date] = None
    weightage: Optional[float] = None


class GoalOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    uom_type: UoMType
    direction: Optional[Direction] = None
    baseline: float
    target: float
    planned_date: date
    weightage: float
    status: GoalStatus
    locked: bool
    parent_goal_id: Optional[str] = None
    employee_id: str
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    latest_score: Optional[float] = None
    predicted_q4: Optional[float] = None
    risk_status: Optional[RiskStatus] = None
    quality_score: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ActualUpsert(BaseModel):
    quarter: Quarter
    planned: float
    actual: float
    actual_date: Optional[date] = None


class ActualOut(BaseModel):
    id: str
    goal_id: str
    quarter: Quarter
    planned: float
    actual: float
    actual_date: Optional[date] = None
    score: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ApprovalCreate(BaseModel):
    goal_id: str
    decision: Literal["approved", "rejected"]
    reason: Optional[str] = None
    comment: Optional[str] = None

    @model_validator(mode="after")
    def reason_required_if_rejected(self) -> ApprovalCreate:
        if self.decision == "rejected" and not self.reason:
            raise ValueError("reason is required when rejecting a goal")
        return self


class ApprovalOut(BaseModel):
    id: str
    goal_id: str
    approver_id: str
    decision: Literal["approved", "rejected"]
    reason: Optional[str] = None
    comment: Optional[str] = None
    created_at: Optional[datetime] = None


class AuditOut(BaseModel):
    id: str
    actor_id: str
    actor_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    before_state: Optional[dict] = None
    after_state: Optional[dict] = None
    created_at: Optional[datetime] = None


class GoalScoreRequest(BaseModel):
    goal_id: Optional[str] = None
    goal_text: str


class GoalScoreResponse(BaseModel):
    score: int
    tip: str
    cached: bool


class HeatmapCell(BaseModel):
    department: str
    quarter: Quarter
    avg_score: Optional[float] = None


class TeamPulseRow(BaseModel):
    employee_id: str
    employee_name: str
    overall_score: Optional[float] = None
    predicted_q4: Optional[float] = None
    risk_status: Optional[RiskStatus] = None
    goal_count: int


class NineBoxPoint(BaseModel):
    employee_id: str
    employee_name: str
    performance: float
    ambition: float
    quadrant: str


class OverrideRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_min_length(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("reason must be at least 10 characters")
        return v


class MessageResponse(BaseModel):
    message: str
