export const SECTIONS = {
  body_paint: { coverage: 15, quality: 20, engine_bay: 20, original: 5 },
  body_plating: { plating_brass: 10 },
  interior: { dash: 10, seats: 10, carpet: 10, door_panels: 10 },
  wheels_tires: { rims_hub_caps: 10, tires: 10 },
  engine: { block: 10, intake: 10, belts_hoses_caps: 5, radiator: 10, breather: 5 },
  appearance: { appearance: 10 },
} as const;
export type Section = keyof typeof SECTIONS;
export const MAXIMA: Record<string, number> = Object.assign({}, ...Object.values(SECTIONS));
export const FIELDS = Object.keys(MAXIMA);
export type ScoreInputs = Record<string, number | null>;
export const METRICS = ['total_score', 'overall_paint', 'overall_interior', 'overall_engine'] as const;
export type Totals = Record<typeof METRICS[number], number | null>;

export function validateInputs(raw: Record<string, unknown>, section?: Section): ScoreInputs {
  const fields = section ? Object.keys(SECTIONS[section]) : FIELDS;
  if (Object.keys(raw).some(key => !fields.includes(key))) throw new Error('Unknown score input');
  return Object.fromEntries(fields.map(field => {
    const value = raw[field];
    if (value == null || (typeof value === 'string' && value.trim() === '')) return [field, null];
    if (!(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) {
      throw new Error(`Invalid score: ${field}`);
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0 || number > MAXIMA[field]) throw new Error(`Invalid score: ${field}`);
    return [field, number];
  }));
}

export function calculate(inputs: ScoreInputs): Totals & { progress_percentage: string } {
  const scores = validateInputs(inputs);
  const sum = (fields: string[]) => fields.some(f => scores[f] === null) ? null : fields.reduce((n, f) => n + scores[f]!, 0);
  const completed = FIELDS.filter(f => scores[f] !== null).length;
  // Integer hundredths; no binary-floating rounding of the percentage.
  const hundredths = Math.floor((completed * 10000 + 8) / 17);
  return {
    overall_paint: sum(Object.keys(SECTIONS.body_paint)),
    overall_interior: sum(Object.keys(SECTIONS.interior)),
    overall_engine: sum(Object.keys(SECTIONS.engine)),
    total_score: sum(FIELDS),
    progress_percentage: `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`,
  };
}
export function statusAfterSave(status: string | null, progress: string): string | null {
  return progress === '100.00' ? 'Judged' : status;
}
