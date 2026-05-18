"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Loader2, Sparkles } from "lucide-react";
import type { Goal, UoMType, Direction } from "@/lib/supabase/types";
import { goalsApi, aiApi } from "@/lib/api";
import { WeightageBar } from "./WeightageBar";

interface GoalFormProps {
  existingGoal?: Goal;
  currentWeightageTotal?: number;
  onSuccess?: (goal: Goal) => void;
}

interface FormState {
  title: string;
  description: string;
  uom_type: UoMType;
  direction: Direction;
  baseline: string;
  target: string;
  planned_date: string;
  weightage: string;
}

const uomOptions: { value: UoMType; label: string }[] = [
  { value: "numeric", label: "Numeric" },
  { value: "percent", label: "Percent" },
  { value: "timeline", label: "Timeline" },
  { value: "zero_based", label: "Zero-Based" },
];

export function GoalForm({ existingGoal, currentWeightageTotal = 0, onSuccess }: GoalFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: existingGoal?.title ?? "",
    description: existingGoal?.description ?? "",
    uom_type: existingGoal?.uom_type ?? "numeric",
    direction: existingGoal?.direction ?? "higher",
    baseline: existingGoal?.baseline?.toString() ?? "",
    target: existingGoal?.target?.toString() ?? "",
    planned_date: existingGoal?.planned_date ?? "",
    weightage: existingGoal?.weightage?.toString() ?? "",
  });

  const [aiScore, setAiScore] = useState<{ score: number; tip: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDirection = form.uom_type === "numeric" || form.uom_type === "percent";
  const showTarget = form.uom_type !== "timeline" && form.uom_type !== "zero_based";
  const showPlannedDate = form.uom_type === "timeline";

  const weightageTotal =
    currentWeightageTotal -
    (existingGoal?.weightage ?? 0) +
    (parseInt(form.weightage) || 0);

  const fetchAiScore = useCallback(async (title: string, description: string) => {
    if (title.length < 10) return;
    setAiLoading(true);
    try {
      const result = await aiApi.scoreGoal(
        `${title}\n${description}`,
        existingGoal?.id
      );
      setAiScore(result);
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  }, [existingGoal?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAiScore(form.title, form.description);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.title, form.description, fetchAiScore]);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError("Title is required");
    if (!form.weightage || parseInt(form.weightage) <= 0)
      return setError("Weightage must be greater than 0");

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      uom_type: form.uom_type,
      weightage: parseInt(form.weightage),
    };

    if (showDirection) body.direction = form.direction;
    if (form.baseline) body.baseline = parseFloat(form.baseline);
    if (showTarget && form.target) body.target = parseFloat(form.target);
    if (showPlannedDate && form.planned_date) body.planned_date = form.planned_date;

    setSubmitting(true);
    try {
      let goal: Goal;
      if (existingGoal) {
        goal = await goalsApi.update(existingGoal.id, body);
      } else {
        goal = await goalsApi.create(body);
      }

      if (weightageTotal === 100) {
        await goalsApi.submit(goal.id);
        goal = await goalsApi.get(goal.id);
      }

      onSuccess?.(goal);
      if (!onSuccess) router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass}>Goal Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Increase quarterly revenue by 15%"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Describe how you'll achieve this goal..."
          rows={3}
          className={clsx(inputClass, "resize-none")}
        />
      </div>

      {(aiLoading || aiScore) && (
        <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <div className="flex-shrink-0 relative w-10 h-10">
            {aiLoading ? (
              <div className="w-10 h-10 flex items-center justify-center">
                <Loader2 size={20} className="text-indigo-500 animate-spin" />
              </div>
            ) : (
              <>
                <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e0e7ff" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke={
                      (aiScore?.score ?? 0) >= 70
                        ? "#16a34a"
                        : (aiScore?.score ?? 0) >= 40
                        ? "#b45309"
                        : "#b91c1c"
                    }
                    strokeWidth="3"
                    strokeDasharray={`${aiScore?.score ?? 0} ${100 - (aiScore?.score ?? 0)}`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                  {aiScore?.score}
                </span>
              </>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1 mb-0.5">
              <Sparkles size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">AI Quality Score</span>
            </div>
            {aiScore && (
              <p className="text-xs text-slate-600">{aiScore.tip}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Measurement Type *</label>
          <select
            value={form.uom_type}
            onChange={(e) => update("uom_type", e.target.value as UoMType)}
            className={inputClass}
          >
            {uomOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {showDirection && (
          <div>
            <label className={labelClass}>Direction *</label>
            <select
              value={form.direction}
              onChange={(e) => update("direction", e.target.value as Direction)}
              className={inputClass}
            >
              <option value="higher">Higher is Better</option>
              <option value="lower">Lower is Better</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Baseline</label>
          <input
            type="number"
            value={form.baseline}
            onChange={(e) => update("baseline", e.target.value)}
            placeholder="Starting value"
            className={inputClass}
          />
        </div>

        {showTarget && (
          <div>
            <label className={labelClass}>Target *</label>
            <input
              type="number"
              value={form.target}
              onChange={(e) => update("target", e.target.value)}
              placeholder="Target value"
              className={inputClass}
            />
          </div>
        )}

        {showPlannedDate && (
          <div>
            <label className={labelClass}>Planned Completion Date *</label>
            <input
              type="date"
              value={form.planned_date}
              onChange={(e) => update("planned_date", e.target.value)}
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Weightage (%) *</label>
        <input
          type="number"
          min={1}
          max={100}
          value={form.weightage}
          onChange={(e) => update("weightage", e.target.value)}
          placeholder="e.g. 30"
          className={inputClass}
        />
      </div>

      <WeightageBar total={weightageTotal} />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {existingGoal ? "Save Changes" : weightageTotal === 100 ? "Save & Submit for Approval" : "Save Goal"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
