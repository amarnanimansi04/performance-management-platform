"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import type { Goal, QuarterlyActual } from "@/lib/supabase/types";
import { goalsApi } from "@/lib/api";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

interface CheckInFormProps {
  goalId: string;
  goal: Goal;
  existingActuals: QuarterlyActual[];
  onUpdate?: (actuals: QuarterlyActual[]) => void;
}

function getActual(actuals: QuarterlyActual[], quarter: string) {
  return actuals.find((a) => a.quarter === quarter) ?? null;
}

export function CheckInForm({ goalId, goal, existingActuals, onUpdate }: CheckInFormProps) {
  const [actuals, setActuals] = useState<QuarterlyActual[]>(existingActuals);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTimeline = goal.uom_type === "timeline";

  async function handleSave(quarter: string, planned: string, actual: string, actualDate: string) {
    setSaving(quarter);
    setError(null);
    try {
      const body: Record<string, unknown> = { quarter, planned: parseFloat(planned) || null };
      if (isTimeline) {
        body.actual_date = actualDate || null;
      } else {
        body.actual = parseFloat(actual) || null;
      }

      const updated = await goalsApi.upsertActual(goalId, body);
      const next = actuals.filter((a) => a.quarter !== quarter).concat(updated);
      setActuals(next);
      onUpdate?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Quarterly Check-ins</h3>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUARTERS.map((q) => (
          <QuarterCard
            key={q}
            quarter={q}
            goal={goal}
            actual={getActual(actuals, q)}
            isSaving={saving === q}
            isTimeline={isTimeline}
            onSave={(planned, actual, actualDate) =>
              handleSave(q, planned, actual, actualDate)
            }
          />
        ))}
      </div>

      {actuals.find((a) => a.quarter === "Q2") && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Risk prediction available after Q2 check-in. Check your goal card for updated risk status.
          </p>
        </div>
      )}
    </div>
  );
}

interface QuarterCardProps {
  quarter: string;
  goal: Goal;
  actual: QuarterlyActual | null;
  isSaving: boolean;
  isTimeline: boolean;
  onSave: (planned: string, actual: string, actualDate: string) => void;
}

function QuarterCard({ quarter, goal, actual, isSaving, isTimeline, onSave }: QuarterCardProps) {
  const [planned, setPlanned] = useState(actual?.planned?.toString() ?? "");
  const [actualVal, setActualVal] = useState(actual?.actual?.toString() ?? "");
  const [actualDate, setActualDate] = useState(actual?.actual_date ?? "");

  const score = actual?.score ?? null;
  const scoreColor =
    score === null ? "text-slate-400" : score >= 90 ? "text-green-600" : score >= 70 ? "text-amber-600" : "text-red-600";

  const inputClass =
    "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{quarter}</span>
        {score !== null && (
          <div className="flex items-center gap-1">
            <CheckCircle size={12} className={scoreColor} />
            <span className={clsx("text-xs font-bold", scoreColor)}>{score.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Planned</label>
          <input
            type="number"
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            placeholder={goal.target?.toString() ?? "—"}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
            {isTimeline ? "Actual Date" : "Actual"}
          </label>
          {isTimeline ? (
            <input
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className={inputClass}
            />
          ) : (
            <input
              type="number"
              value={actualVal}
              onChange={(e) => setActualVal(e.target.value)}
              placeholder="Actual value"
              className={inputClass}
            />
          )}
        </div>
      </div>

      {score !== null && (
        <div className="score-bar">
          <div
            className={clsx(
              "score-bar-fill",
              score >= 90 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      )}

      <button
        onClick={() => onSave(planned, actualVal, actualDate)}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 disabled:opacity-60 transition-colors"
      >
        {isSaving && <Loader2 size={11} className="animate-spin" />}
        Save {quarter}
      </button>
    </div>
  );
}
