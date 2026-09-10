import type { Totals } from './scoring';
export const CLASSES = ['Pre-1950', '1950s', '1960s', '1970s', '1980s', '1990s', 'Post-2000'] as const;
export function classification(year: number): string {
  return CLASSES[[1950, 1960, 1970, 1980, 1990, 2000].findIndex(limit => year < limit)] ?? 'Post-2000';
}
export type AwardInput = Totals & {
  car_id: string; legacy_car_id: string | null; legacy_score_id: string | null;
  car_number: string; vehicle_year: number; vehicle_make: string; vehicle_model: string;
  participant_name: string; participant_city: string | null;
};
export type Award = AwardInput & { award: string; car_number_display: string };
// WordPress mysqli text queries return totals as numeric strings. In PHP,
// NULL compares below the string '0' (unlike the integer 0). Reproduce that
// verified source representation for our bounded nonnegative Postgres totals.
export function phpNumericCompare(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  return a - b;
}
/** Input MUST be the unmodified result of ORDER BY total_score DESC NULLS LAST.
 * No initial re-sort or hidden tie key: preserve the database's observed tie order.
 */
export function calculateAwards(orderedInput: readonly AwardInput[]): Award[] {
  const remaining = orderedInput.map(row => ({ ...row }));
  if (new Set(remaining.map(row => row.car_id)).size !== remaining.length) throw new Error('Duplicate car in award input');
  const awards: Award[] = [];
  const take = (index: number, award: string, star = false) => {
    const [row] = remaining.splice(index, 1);
    awards.push({ ...row, award, car_number_display: row.car_number + (star ? '*' : '') });
  };
  if (!remaining.length) return awards;
  take(0, 'Best in Show');
  for (const label of CLASSES) {
    const index = remaining.findIndex(row => classification(row.vehicle_year) === label);
    if (index >= 0) take(index, `Best in Class: ${label}`);
  }
  for (const [name, field] of [['Paint', 'overall_paint'], ['Interior', 'overall_interior'], ['Engine', 'overall_engine']] as const) {
    remaining.sort((a, b) => phpNumericCompare(b[field], a[field]));
    if (remaining.length) take(0, `Best in Category: ${name}`, remaining.slice(1).some(row => phpNumericCompare(row[field], remaining[0][field]) === 0));
  }
  remaining.sort((a, b) => phpNumericCompare(b.total_score, a.total_score));
  for (let rank = 1; remaining.length && rank <= 40; rank++) take(0, `Top 40: ${rank}`);
  return awards;
}
