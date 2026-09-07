'use client';

import { useMemo } from 'react';
import type { SsCumulativePoint } from '@/src/lib/api';
import { moneyCompact } from '@/src/lib/format';

/**
 * Two cumulative-benefit curves — claim early vs. claim late — that cross at the
 * breakeven age. Before breakeven the early claimant is ahead; after it, the
 * later claimant pulls in front (shown by which line sits on top).
 */
export function BreakevenChart({
  points,
  earlyAge,
  lateAge,
  breakevenAge,
}: {
  points: SsCumulativePoint[];
  earlyAge: number;
  lateAge: number;
  breakevenAge: number | null;
}) {
  const W = 720;
  const H = 300;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxVal = Math.max(...points.map((p) => Math.max(p.early, p.late)), 1);
    const minAge = points[0].age;
    const maxAge = points[points.length - 1].age;
    const x = (age: number) =>
      P.left + ((age - minAge) / (maxAge - minAge || 1)) * (W - P.left - P.right);
    const y = (v: number) => P.top + (1 - v / maxVal) * (H - P.top - P.bottom);
    return { maxVal, minAge, maxAge, x, y };
  }, [points]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm opacity-50">
        Enter your details to see the comparison.
      </div>
    );
  }

  const { x, y, maxVal, minAge, maxAge } = geom;
  const earlyLine = points.map((p) => `${x(p.age)},${y(p.early)}`).join(' ');
  const lateLine = points.map((p) => `${x(p.age)},${y(p.late)}`).join(' ');
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const ageTicks = points
    .filter((_, i) => i % Math.ceil(points.length / 7) === 0)
    .map((p) => p.age);
  const beX = breakevenAge != null && breakevenAge <= maxAge ? x(breakevenAge) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="Cumulative Social Security benefits: claiming early vs. late">
        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)}
              stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end" fontSize="10"
              fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}

        {/* breakeven marker */}
        {beX != null && (
          <g className="text-black/60 dark:text-white/60">
            <line x1={beX} x2={beX} y1={P.top} y2={H - P.bottom}
              stroke="currentColor" strokeOpacity="0.4" strokeDasharray="4 4" />
            <text x={beX} y={P.top + 10} textAnchor="middle" fontSize="10"
              fill="currentColor">breakeven</text>
          </g>
        )}

        {/* claim-early curve (amber) */}
        <polyline points={earlyLine} fill="none"
          className="text-amber-500" stroke="currentColor" strokeWidth="2.5" />
        {/* claim-late curve (emerald) */}
        <polyline points={lateLine} fill="none"
          className="text-emerald-600 dark:text-emerald-400" stroke="currentColor" strokeWidth="2.5" />

        {ageTicks.map((age) => (
          <text key={age} x={x(age)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{age}</text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-amber-500" label={`Claim at ${earlyAge}`} />
        <Legend swatch="bg-emerald-500" label={`Claim at ${lateAge}`} />
        <span className="ml-auto">Age →</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-4 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
