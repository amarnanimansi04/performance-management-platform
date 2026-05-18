"use client";

import clsx from "clsx";

interface WeightageBarProps {
  total: number;
}

export function WeightageBar({ total }: WeightageBarProps) {
  const isValid = total === 100;
  const isOver = total > 100;
  const capped = Math.min(total, 100);

  const barColor = isValid
    ? "bg-green-500"
    : isOver
    ? "bg-red-500"
    : "bg-amber-500";

  const textColor = isValid
    ? "text-green-700"
    : isOver
    ? "text-red-700"
    : "text-amber-700";

  const message = isValid
    ? "Weightage is balanced. Ready to submit."
    : isOver
    ? `Over by ${total - 100}%. Reduce goal weightages.`
    : `${100 - total}% remaining. Add more goals or adjust weightages.`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Total Weightage</span>
        <span className={clsx("text-xs font-bold", textColor)}>{total}%</span>
      </div>
      <div className="score-bar">
        <div
          className={clsx("score-bar-fill", barColor)}
          style={{ width: `${capped}%` }}
        />
      </div>
      <p className={clsx("text-xs", textColor)}>{message}</p>
    </div>
  );
}
