/** Safe currency formatter — returns "$0" for NaN/undefined/null instead of "$NaN". */
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '$0';
  const abs = Math.abs(value);
  return `${value < 0 ? '-' : ''}$${abs.toLocaleString('en-US')}`;
}

/** Safe percent formatter — returns "0.0%" for NaN/undefined/null. */
export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '0.0%';
  return `${(value * 100).toFixed(decimals)}%`;
}
