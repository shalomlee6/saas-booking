/** Completed visits. Fewer than two is New; two or more is Returning. */
export function customerTypeFromVisits(totalVisits: number): 'new' | 'returning' {
  return totalVisits < 2 ? 'new' : 'returning';
}

/** Completed revenue divided by completed visits. Zero visits yields 0. */
export function averageVisitValue(totalRevenue: number, totalVisits: number): number {
  if (totalVisits <= 0) return 0;
  return totalRevenue / totalVisits;
}
