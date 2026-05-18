import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export const goalsApi = {
  list(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<import("@/lib/supabase/types").Goal[]>(`/goals${qs}`);
  },
  get(id: string) {
    return request<import("@/lib/supabase/types").Goal>(`/goals/${id}`);
  },
  create(body: Record<string, unknown>) {
    return request<import("@/lib/supabase/types").Goal>("/goals", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  update(id: string, body: Record<string, unknown>) {
    return request<import("@/lib/supabase/types").Goal>(`/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  submit(id: string) {
    return request<import("@/lib/supabase/types").Goal>(`/goals/${id}/submit`, {
      method: "POST",
    });
  },
  override(id: string, reason: string) {
    return request<import("@/lib/supabase/types").Goal>(`/goals/${id}/override`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  getActuals(id: string) {
    return request<import("@/lib/supabase/types").QuarterlyActual[]>(
      `/goals/${id}/actuals`
    );
  },
  upsertActual(id: string, body: Record<string, unknown>) {
    return request<import("@/lib/supabase/types").QuarterlyActual>(
      `/goals/${id}/actuals`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  },
};

export const approvalsApi = {
  list() {
    return request<import("@/lib/supabase/types").Approval[]>("/approvals");
  },
  decide(body: { goal_id: string; decision: "approved" | "rejected"; comment?: string }) {
    return request<import("@/lib/supabase/types").Approval>("/approvals/decide", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export const analyticsApi = {
  heatmap() {
    return request<{ department: string; Q1: number; Q2: number; Q3: number; Q4: number }[]>(
      "/analytics/heatmap"
    );
  },
  teamPulse() {
    return request<
      {
        user_id: string;
        full_name: string;
        department: string;
        overall_score: number;
        risk_status: import("@/lib/supabase/types").RiskStatus;
        goal_count: number;
        at_risk_count: number;
      }[]
    >("/analytics/team-pulse");
  },
  nineBox() {
    return request<
      {
        user_id: string;
        full_name: string;
        performance_score: number;
        ambition_score: number;
        department: string;
      }[]
    >("/analytics/nine-box");
  },
};

export const aiApi = {
  scoreGoal(goal_text: string, goal_id?: string) {
    return request<{ score: number; tip: string }>("/ai/score-goal", {
      method: "POST",
      body: JSON.stringify({ goal_text, goal_id }),
    });
  },
};

export const auditApi = {
  list(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<import("@/lib/supabase/types").AuditLog[]>(`/audit${qs}`);
  },
};

export const exportApi = {
  async downloadCSV() {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "performance-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
  async downloadExcel() {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/export/excel`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "performance-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },
};
