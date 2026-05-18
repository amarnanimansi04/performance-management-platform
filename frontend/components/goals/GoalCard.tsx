"use client";

import clsx from "clsx";
import { Lock, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { Goal } from "@/lib/supabase/types";

function scoreColor(score: number | null) {
  if (score === null) return "bg-slate-300";
  if (score >= 90) return "bg-green-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

const uomLabels: Record<string, string> = {
  numeric: "Numeric",
  percent: "Percent",
  timeline: "Timeline",
  zero_based: "Zero-Based",
};

const riskIcons = {
  on_track: <CheckCircle size={12} />,
  at_risk: <AlertTriangle size={12} />,
  behind: <AlertTriangle size={12} />,
};

interface GoalCardProps {
  goal: Goal;
  onClick?: () => void;
  qualityScore?: number | null;
  overallScore?: number | null;
  q4Prediction?: number | null;
}

export function GoalCard({ goal, onClick, qualityScore, overallScore, q4Prediction }: GoalCardProps) {
  const score = overallScore ?? null;
  const trend = q4Prediction !== null && q4Prediction !== undefined && score !== null
    ? q4Prediction > score
      ? "up"
      : q4Prediction < score
      ? "down"
      : "flat"
    : null;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "card p-5 flex flex-col gap-3",
        onClick && "cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {goal.status === "locked" && (
              <Lock size={13} className="text-indigo-500 flex-shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-slate-800 truncate">{goal.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`status-${goal.status}`}>
              {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
              {uomLabels[goal.uom_type]}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">
              {goal.weightage}%
            </span>
          </div>
        </div>

        {qualityScore !== null && qualityScore !== undefined && (
          <div className="flex-shrink-0 relative w-10 h-10">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={qualityScore >= 70 ? "#16a34a" : qualityScore >= 40 ? "#b45309" : "#b91c1c"}
                strokeWidth="3"
                strokeDasharray={`${qualityScore} ${100 - qualityScore}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700 rotate-0">
              {qualityScore}
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Score</span>
          <span className={clsx("text-xs font-bold", scoreTextColor(score))}>
            {score !== null ? `${score.toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="score-bar">
          <div
            className={clsx("score-bar-fill", scoreColor(score))}
            style={{ width: `${Math.min(score ?? 0, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {goal.risk_status && (
          <span className={`risk-${goal.risk_status}`}>
            {riskIcons[goal.risk_status]}
            {goal.risk_status.replace("_", " ")}
          </span>
        )}

        {trend && q4Prediction !== null && q4Prediction !== undefined && (
          <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
            {trend === "up" && <TrendingUp size={13} className="text-green-500" />}
            {trend === "down" && <TrendingDown size={13} className="text-red-500" />}
            {trend === "flat" && <Minus size={13} className="text-slate-400" />}
            <span>Q4: {q4Prediction.toFixed(1)}%</span>
          </div>
        )}

        {!goal.risk_status && !trend && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock size={12} />
            <span>No data yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
