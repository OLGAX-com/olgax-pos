/**
 * Splits a sale's tax across its items in proportion to each item's total.
 * Amounts are handled in cents. The rounding difference goes to the item with
 * the largest total, so the parts always add up to taxAmount exactly.
 */
export function allocateTax(itemTotals: number[], taxAmount: number): number[] {
  const base = itemTotals.reduce((sum, t) => sum + t, 0);
  if (itemTotals.length === 0 || base <= 0) return itemTotals.map(() => 0);

  const cents = Math.round(taxAmount * 100);
  const parts = itemTotals.map((t) => Math.round((cents * t) / base));

  const largest = itemTotals.indexOf(Math.max(...itemTotals));
  const others = parts.reduce((sum, p, i) => (i === largest ? sum : sum + p), 0);
  parts[largest] = cents - others;

  return parts.map((p) => p / 100);
}

/**
 * Share of a sale's tax that belongs to each unit of item value.
 * Multiplying a refund amount by this gives the tax portion of that refund.
 */
export function taxShare(taxAmount: number, itemTotals: number[]): number {
  const base = itemTotals.reduce((sum, t) => sum + t, 0);
  return base > 0 ? taxAmount / base : 0;
}
