"use client";

import { useState } from "react";
import clsx from "clsx";

interface NineBoxPoint {
  user_id: string;
  full_name: string;
  performance_score: number;
  ambition_score: number;
  department: string;
}

interface NineBoxGridProps {
  data: NineBoxPoint[];
}

const quadrantLabels: Record<string, string> = {
  "2-0": "Low Performer\nLow Ambition",
  "2-1": "Low Performer\nModerate Ambition",
  "2-2": "Low Performer\nHigh Ambition",
  "1-0": "Core\nEmployee",
  "1-1": "Core\nContributor",
  "1-2": "High Potential",
  "0-0": "Consistent\nStar",
  "0-1": "Strong\nPerformer",
  "0-2": "Top\nTalent",
};

const cellColors: Record<string, string> = {
  "2-0": "bg-red-100 border-red-200",
  "2-1": "bg-red-50 border-red-100",
  "2-2": "bg-amber-100 border-amber-200",
  "1-0": "bg-amber-50 border-amber-100",
  "1-1": "bg-amber-100 border-amber-200",
  "1-2": "bg-green-50 border-green-100",
  "0-0": "bg-green-50 border-green-100",
  "0-1": "bg-green-100 border-green-200",
  "0-2": "bg-green-200 border-green-300",
};

function getCell(p: NineBoxPoint) {
  const perfRow = p.performance_score >= 70 ? 0 : p.performance_score >= 40 ? 1 : 2;
  const ambCol = p.ambition_score >= 70 ? 2 : p.ambition_score >= 40 ? 1 : 0;
  return `${perfRow}-${ambCol}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
];

export function NineBoxGrid({ data }: NineBoxGridProps) {
  const [tooltip, setTooltip] = useState<NineBoxPoint | null>(null);

  const grouped = data.reduce<Record<string, NineBoxPoint[]>>((acc, p) => {
    const key = getCell(p);
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});

  return (
    <div className="relative">
      <div className="flex gap-2 mb-2 items-center">
        <span className="text-xs text-slate-400 transform -rotate-90 origin-center whitespace-nowrap w-4 text-center" style={{ marginRight: 4 }}>
          Performance
        </span>
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => {
                const key = `${row}-${col}`;
                const cell = grouped[key] ?? [];
                const label = quadrantLabels[key];
                const color = cellColors[key];

                return (
                  <div
                    key={key}
                    className={clsx(
                      "border rounded-xl p-3 min-h-[120px] flex flex-col gap-2",
                      color
                    )}
                  >
                    <p className="text-[10px] font-semibold text-slate-600 leading-tight whitespace-pre-line">
                      {label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {cell.map((p, i) => (
                        <button
                          key={p.user_id}
                          onMouseEnter={() => setTooltip(p)}
                          onMouseLeave={() => setTooltip(null)}
                          className={clsx(
                            "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center relative",
                            avatarColors[i % avatarColors.length]
                          )}
                          title={p.full_name}
                        >
                          {initials(p.full_name)}
                        </button>
                      ))}
                      {cell.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">Empty</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-slate-400">Low Ambition</span>
            <span className="text-[10px] text-slate-400">High Ambition</span>
          </div>
        </div>
      </div>

      {tooltip && (
        <div className="fixed z-50 bottom-6 right-6 bg-white border border-slate-200 rounded-xl shadow-lg p-4 min-w-[180px]">
          <p className="text-sm font-semibold text-slate-800">{tooltip.full_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{tooltip.department}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Performance</span>
              <span className="font-medium">{tooltip.performance_score.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Ambition</span>
              <span className="font-medium">{tooltip.ambition_score.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
