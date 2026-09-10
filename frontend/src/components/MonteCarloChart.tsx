'use client';

import { useId, useMemo } from 'react';
import type { MonteCarloBand } from '@/src/lib/api';
import { moneyCompact } from '@/src/lib/format';

/**
 * Outcome fan for a Monte Carlo run: the shaded band spans the 10th–90th
 * percentile of the portfolio balance at each age, with the median line down the
 * middle. A wide band means high uncertainty; the band touching zero means some
 * trials ran out of money.
 */
export function MonteCarloChart({ points }: { points: MonteCarloBand[] }) {
  const gradId = useId();
  const W = 720;
  const H = 300;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxVal = Math.max(...points.map((p) => p.p90), 1);
    const minAge = points[0].age;
    const maxAge = points[points.length - 1].age;
    const x = (a: number) => P.left + ((a - minAge) / (maxAge - minAge || 1)) * (W - P.left - P.right);
    const y = (v: number) => P.top + (1 - v / maxVal) * (H - P.top - P.bottom);
    return { maxVal, minAge, maxAge, x, y };
  }, [points]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm opacity-50">
        Enter your details to run the simulation.
      </div>
    );
  }

  const { x, y, maxVal } = geom;
  const upper = points.map((p) => `${x(p.age)},${y(p.p90)}`);
  const lower = points.map((p) => `${x(p.age)},${y(p.p10)}`).reverse();
  const band = [...upper, ...lower].join(' ');
  const median = points.map((p) => `${x(p.age)},${y(p.p50)}`).join(' ');
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const ageTicks = points.filter((_, i) => i % Math.ceil(points.length / 7) === 0).map((p) => p.age);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="Monte Carlo outcome fan: 10th to 90th percentile balance by age">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end" fontSize="10" fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}

        <g className="text-cyan-600 dark:text-cyan-400">
          <polygon points={band} fill={`url(#${gradId})`} />
          <polyline points={median} fill="none" stroke="currentColor" strokeWidth="2.5" />
        </g>

        {ageTicks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{a}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-cyan-500" label="Median outcome" />
        <Legend swatch="bg-cyan-500/25" label="10th–90th percentile range" />
        <span className="ml-auto">Portfolio balance (today's $) →</span>
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
