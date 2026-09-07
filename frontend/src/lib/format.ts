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

/** Decimal rate (0.07) as a percent string ("7%"). */
export function percent(rate: number): string {
  return `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}
