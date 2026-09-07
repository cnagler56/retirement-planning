'use client';

import { useId, useMemo, useState } from 'react';
import type { ProjectionPoint } from '@/src/lib/api';
import { moneyCompact, money } from '@/src/lib/format';

/**
 * Dependency-free SVG chart of the portfolio balance across the whole plan —
 * rising through the saving years, then drawn down in retirement. A dashed
 * marker shows the retirement age; if the money runs out, that age is flagged.
 * All values are in today's dollars.
 */
export function ProjectionChart({
  points,
  retirementAge,
  moneyLastsToAge,
}: {
  points: ProjectionPoint[];
  retirementAge: number;
  moneyLastsToAge: number | null;
}) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 300;
  const P = { top: 16, right: 16, bottom: 28, left: 8 };

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxBalance = Math.max(...points.map((p) => p.balance), 1);
    const minAge = points[0].age;
    const maxAge = points[points.length - 1].age;
    const x = (age: number) =>
      P.left + ((age - minAge) / (maxAge - minAge || 1)) * (W - P.left - P.right);
    const y = (val: number) => P.top + (1 - val / maxBalance) * (H - P.top - P.bottom);
    return { maxBalance, minAge, maxAge, x, y };
  }, [points]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm opacity-50">
        Enter your details to see the projection.
      </div>
    );
  }

  const { x, y, maxBalance, minAge, maxAge } = geom;
  const line = points.map((p) => `${x(p.age)},${y(p.balance)}`).join(' ');
  const area = `${x(points[0].age)},${y(0)} ${line} ${x(points[points.length - 1].age)},${y(0)}`;

  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * maxBalance);
  const ageTicks = points.filter((_, i) => i % Math.ceil(points.length / 7) === 0).map((p) => p.age);
  const hovered = hover != null ? points[hover] : null;
  const retX = retirementAge >= minAge && retirementAge <= maxAge ? x(retirementAge) : null;
  const zeroX = moneyLastsToAge != null && moneyLastsToAge <= maxAge ? x(moneyLastsToAge) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Projected portfolio balance across the retirement plan"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const age = minAge + ((px - P.left) / (W - P.left - P.right)) * (maxAge - minAge);
          let nearest = 0;
          let best = Infinity;
          points.forEach((p, i) => {
            const d = Math.abs(p.age - age);
            if (d < best) { best = d; nearest = i; }
          });
          setHover(nearest);
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)}
              stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - P.right} y={y(v) - 4} textAnchor="end"
              fontSize="10" fill="currentColor">{moneyCompact(v)}</text>
          </g>
        ))}

        {/* retirement-age marker */}
        {retX != null && (
          <g className="text-black/60 dark:text-white/60">
            <line x1={retX} x2={retX} y1={P.top} y2={H - P.bottom}
              stroke="currentColor" strokeOpacity="0.4" strokeDasharray="4 4" />
            <text x={retX} y={P.top + 10} textAnchor="middle" fontSize="10" fill="currentColor">retire</text>
          </g>
        )}

        {/* balance area + line */}
        <g className="text-emerald-600 dark:text-emerald-400">
          <polygon points={area} fill={`url(#${gradId})`} />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" />
        </g>

        {/* depletion marker */}
        {zeroX != null && (
          <g className="text-red-500">
            <line x1={zeroX} x2={zeroX} y1={P.top} y2={H - P.bottom}
              stroke="currentColor" strokeOpacity="0.5" />
            <text x={zeroX} y={H - P.bottom - 4} textAnchor="middle" fontSize="10" fill="currentColor">
              $0 at {moneyLastsToAge}
            </text>
          </g>
        )}

        {ageTicks.map((age) => (
          <text key={age} x={x(age)} y={H - 8} textAnchor="middle"
            fontSize="10" className="fill-black/50 dark:fill-white/50">{age}</text>
        ))}

        {hovered && (
          <g className="text-emerald-600 dark:text-emerald-400">
            <line x1={x(hovered.age)} x2={x(hovered.age)} y1={P.top} y2={H - P.bottom}
              stroke="currentColor" strokeOpacity="0.35" />
            <circle cx={x(hovered.age)} cy={y(hovered.balance)} r="4" fill="currentColor" />
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-emerald-500" label="Portfolio balance (today's $)" />
        {hovered && (
          <span className="ml-auto">
            Age {hovered.age}: <strong>{money(hovered.balance)}</strong>
            {hovered.phase === 'retirement' && hovered.ssIncome > 0 && (
              <> · SS {money(hovered.ssIncome)}/yr</>
            )}
          </span>
        )}
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
