'use client';

import { useMemo } from 'react';
import { moneyCompact } from '@/src/lib/format';

export interface ScenarioSeries {
  name: string;
  color: string; // hex color, e.g. "#10b981"
  points: { age: number; balance: number }[];
}

/** Overlaid portfolio-balance paths, one line per scenario, on shared axes. */
export function ScenarioChart({ series }: { series: ScenarioSeries[] }) {
  const W = 720;
  const H = 300;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length < 2) return null;
    const maxVal = Math.max(...all.map((p) => p.balance), 1);
    const minAge = Math.min(...all.map((p) => p.age));
    const maxAge = Math.max(...all.map((p) => p.age));
    const x = (a: number) => P.left + ((a - minAge) / (maxAge - minAge || 1)) * (W - P.left - P.right);
    const y = (v: number) => P.top + (1 - v / maxVal) * (H - P.top - P.bottom);
    return { maxVal, minAge, maxAge, x, y };
  }, [series]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm opacity-50">
        Add scenarios to compare their paths.
      </div>
    );
  }

  const { x, y, maxVal, minAge, maxAge } = geom;
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const ageTicks: number[] = [];
  for (let a = Math.ceil(minAge / 5) * 5; a <= maxAge; a += 5) ageTicks.push(a);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scenario balance comparison">
        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end" fontSize="10" fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}
        {series.map((s, i) => (
          <polyline key={i} points={s.points.map((p) => `${x(p.age)},${y(p.balance)}`).join(' ')}
            fill="none" stroke={s.color} strokeWidth="2.5" />
        ))}
        {ageTicks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{a}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="ml-auto">Portfolio balance (today&apos;s $) →</span>
      </div>
    </div>
  );
}
