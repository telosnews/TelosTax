/** Shared color palette for the Sankey tax flow diagram. */

export const SANKEY_COLORS: Record<string, string> = {
  // Income sources (blue family)
  income:       '#3B82F6',

  // Intermediate nodes (slate)
  intermediate: '#94A3B8',

  // Adjustments (amber)
  adjustment:   '#F59E0B',

  // Deductions (teal)
  deduction:    '#14B8A6',

  // QBI Deduction (cyan)
  qbi:          '#06B6D4',

  // Legacy alias — maps to deduction teal for backward compat
  reduction:    '#14B8A6',

  // Tax items (red/orange family)
  tax:          '#EF4444',
  surtax:       '#F97316',

  // Credits & payments (violet/purple family)
  credit:       '#8B5CF6',
  payment:      '#A78BFA',

  // Final result
  refund:       '#10B981',
  owed:         '#F59E0B',
};

export function colorForCategory(category: string): string {
  return SANKEY_COLORS[category] || '#64748B';
}
