'use client';

import { useMemo } from 'react';
import { moneyCompact } from '@/src/lib/format';

export interface WealthPoint {
  age: number;
  baseline: number;
  converted: number;
}

/**
 * After-tax net worth over the plan — no conversions vs. the conversion strategy.
 * The two curves diverge as gap-year conversions cut future taxes and RMDs.
 */
export function LifetimeWealthChart({ series }: { series: WealthPoint[] }) {
  const W = 720;
  const H = 300;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    if (series.length < 2) return null;
    const maxVal = Math.max(...series.map((p) => Math.max(p.baseline, p.converted)), 1);
    const minAge = series[0].age;
    const maxAge = series[series.length - 1].age;
    const x = (a: number) => P.left + ((a - minAge) / (maxAge - minAge || 1)) * (W - P.left - P.right);
    const y = (v: number) => P.top + (1 - v / maxVal) * (H - P.top - P.bottom);
    return { maxVal, minAge, maxAge, x, y };
  }, [series]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm opacity-50">
        Enter your details to see the comparison.
      </div>
    );
  }

  const { x, y, maxVal, minAge, maxAge } = geom;
  const baseLine = series.map((p) => `${x(p.age)},${y(p.baseline)}`).join(' ');
  const convLine = series.map((p) => `${x(p.age)},${y(p.converted)}`).join(' ');
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const ageTicks = series.filter((_, i) => i % Math.ceil(series.length / 7) === 0).map((p) => p.age);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="After-tax net worth over the plan: baseline vs. conversions">
        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end" fontSize="10" fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}
        <polyline points={baseLine} fill="none" className="text-amber-500" stroke="currentColor" strokeWidth="2.5" />
        <polyline points={convLine} fill="none" className="text-emerald-600 dark:text-emerald-400" stroke="currentColor" strokeWidth="2.5" />
        {ageTicks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{a}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-emerald-500" label="With conversions" />
        <Legend swatch="bg-amber-500" label="No conversions" />
        <span className="ml-auto">After-tax net worth (today's $) →</span>
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
