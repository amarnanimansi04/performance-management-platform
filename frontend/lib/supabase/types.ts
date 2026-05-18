export type Role = "employee" | "manager" | "admin";

export type UoMType = "numeric" | "percent" | "timeline" | "zero_based";

export type Direction = "higher" | "lower";

export type GoalStatus = "draft" | "pending" | "approved" | "rejected" | "locked";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export type RiskStatus = "on_track" | "at_risk" | "behind";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department: string;
  manager_id: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  uom_type: UoMType;
  direction: Direction | null;
  baseline: number | null;
  target: number | null;
  planned_date: string | null;
  weightage: number;
  status: GoalStatus;
  quality_score: number | null;
  risk_status: RiskStatus | null;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface QuarterlyActual {
  id: string;
  goal_id: string;
  quarter: Quarter;
  planned: number | null;
  actual: number | null;
  actual_date: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export interface GoalScore {
  goal_id: string;
  overall_score: number;
  q1_score: number | null;
  q2_score: number | null;
  q3_score: number | null;
  q4_score: number | null;
  q4_prediction: number | null;
}

export interface Approval {
  id: string;
  goal_id: string;
  reviewer_id: string;
  decision: "approved" | "rejected" | null;
  comment: string | null;
  created_at: string;
  goal?: Goal;
  reviewer?: User;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
  actor?: User;
}
