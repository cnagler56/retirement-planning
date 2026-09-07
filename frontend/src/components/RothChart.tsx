'use client';

import { useMemo } from 'react';
import type { RothPoint } from '@/src/lib/api';
import { moneyCompact } from '@/src/lib/format';

/**
 * Two after-tax-value curves over time — convert now vs. don't. The gap between
 * them at the horizon is the dollar advantage of the winning strategy.
 */
export function RothChart({ points }: { points: RothPoint[] }) {
  const W = 720;
  const H = 280;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxVal = Math.max(...points.map((p) => Math.max(p.convert, p.noConvert)), 1);
    const minYear = points[0].year;
    const maxYear = points[points.length - 1].year;
    const x = (yr: number) =>
      P.left + ((yr - minYear) / (maxYear - minYear || 1)) * (W - P.left - P.right);
    const y = (v: number) => P.top + (1 - v / maxVal) * (H - P.top - P.bottom);
    return { maxVal, minYear, maxYear, x, y };
  }, [points]);

  if (!geom) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm opacity-50">
        Enter your details to see the comparison.
      </div>
    );
  }

  const { x, y, maxVal, minYear, maxYear } = geom;
  const convertLine = points.map((p) => `${x(p.year)},${y(p.convert)}`).join(' ');
  const noConvertLine = points.map((p) => `${x(p.year)},${y(p.noConvert)}`).join(' ');
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const yearTicks = points.filter((_, i) => i % Math.ceil(points.length / 7) === 0).map((p) => p.year);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="After-tax value over time: convert vs. don't convert">
        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end" fontSize="10" fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}

        <polyline points={noConvertLine} fill="none"
          className="text-amber-500" stroke="currentColor" strokeWidth="2.5" />
        <polyline points={convertLine} fill="none"
          className="text-emerald-600 dark:text-emerald-400" stroke="currentColor" strokeWidth="2.5" />

        {yearTicks.map((yr) => (
          <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{minYear === yr ? 'now' : `+${yr}y`}</text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-emerald-500" label="Convert to Roth" />
        <Legend swatch="bg-amber-500" label="Don't convert" />
        <span className="ml-auto">After-tax value →</span>
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
