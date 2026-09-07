'use client';

import { useMemo } from 'react';
import type { ConversionRatePoint } from '@/src/lib/api';
import { money } from '@/src/lib/format';

/**
 * Marginal tax rate on each successive dollar of conversion. Where the curve
 * humps above the dashed nominal-bracket line, extra Social Security (or capital
 * gains) is being pulled into tax — the "tax torpedo." A cumulative-rate line
 * shows the blended rate on the whole conversion.
 */
export function RothTorpedoChart({
  points,
  nominalBracket,
}: {
  points: ConversionRatePoint[];
  nominalBracket: number;
}) {
  const W = 720;
  const H = 260;
  const P = { top: 16, right: 16, bottom: 28, left: 34 };

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const maxRate = Math.max(...points.map((p) => Math.max(p.marginalRate, p.cumulativeRate)), nominalBracket, 0.1);
    const yMax = Math.ceil((maxRate + 0.02) * 20) / 20; // round up to 5%
    const maxAmt = points[points.length - 1].amount || 1;
    const x = (amt: number) => P.left + (amt / maxAmt) * (W - P.left - P.right);
    const y = (rate: number) => P.top + (1 - rate / yMax) * (H - P.top - P.bottom);
    return { yMax, maxAmt, x, y };
  }, [points, nominalBracket]);

  if (!geom) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm opacity-50">
        Enter an amount to convert to see the marginal-rate curve.
      </div>
    );
  }

  const { yMax, maxAmt, x, y } = geom;
  const marginal = points.map((p) => `${x(p.amount)},${y(p.marginalRate)}`).join(' ');
  const cumulative = points.map((p) => `${x(p.amount)},${y(p.cumulativeRate)}`).join(' ');
  const rateTicks: number[] = [];
  for (let r = 0; r <= yMax + 1e-9; r += 0.05) rateTicks.push(Math.round(r * 100) / 100);
  const amtTicks = points.filter((_, i) => i % Math.ceil(points.length / 6) === 0).map((p) => p.amount);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="Marginal tax rate as the conversion amount grows">
        {rateTicks.map((r, i) => (
          <g key={i} className="text-black/40 dark:text-white/40">
            <line x1={P.left} x2={W - P.right} y1={y(r)} y2={y(r)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={P.left - 4} y={y(r) + 3} textAnchor="end" fontSize="10" fill="currentColor">
              {Math.round(r * 100)}%
            </text>
          </g>
        ))}

        {/* nominal bracket reference */}
        <g className="text-black/60 dark:text-white/60">
          <line x1={P.left} x2={W - P.right} y1={y(nominalBracket)} y2={y(nominalBracket)}
            stroke="currentColor" strokeOpacity="0.5" strokeDasharray="5 4" />
          <text x={W - P.right} y={y(nominalBracket) - 4} textAnchor="end" fontSize="10" fill="currentColor">
            nominal bracket {Math.round(nominalBracket * 100)}%
          </text>
        </g>

        <polyline points={cumulative} fill="none"
          className="text-black/45 dark:text-white/50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
        <polyline points={marginal} fill="none"
          className="text-emerald-600 dark:text-emerald-400" stroke="currentColor" strokeWidth="2.5" />

        {amtTicks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10"
            className="fill-black/50 dark:fill-white/50">{a >= 1000 ? `${Math.round(a / 1000)}k` : a}</text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs opacity-70">
        <Legend swatch="bg-emerald-500" label="Marginal rate (next $)" />
        <Legend swatch="bg-black/40 dark:bg-white/40" label="Blended rate (whole conversion)" />
        <span className="ml-auto">Convert up to {money(maxAmt)} →</span>
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
