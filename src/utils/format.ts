/** Format a price with 2 decimal places and dollar sign */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/** Format a price change with sign and dollar */
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${change.toFixed(2)}`;
}

/** Format a percentage with sign */
export function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** Format large numbers with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format volume (abbreviated) */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
