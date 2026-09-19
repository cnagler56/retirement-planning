/** Whole-dollar currency, e.g. $1,234,567. */
export function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact currency for tight spaces, e.g. $1.2M, $850K. */
export function moneyCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

/** A number with thousands separators for display, e.g. 1500000 → "1,500,000".
 *  Keeps up to two decimals when present; empty string for non-finite values. */
export function groupNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Parse a user-typed number that may contain commas or a currency symbol. */
export function parseNumberInput(s: string): number {
  const cleaned = s.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Decimal rate (0.07) as a percent string ("7%"). */
export function percent(rate: number): string {
  return `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}
