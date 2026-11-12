/** Bounded adaptation evidence; cumulative diagnostics remain independent. */
export interface RecentSelectionEvidence {
  readonly correctness: readonly boolean[];
  readonly timingMs: readonly number[];
}

export const SELECTION_CORRECTNESS_WINDOW = 32;
export const SELECTION_TIMING_WINDOW = 24;

export function appendSelectionEvidence(
  prior: RecentSelectionEvidence | undefined,
  correct: boolean,
  timingMs: number | null,
): RecentSelectionEvidence {
  return {
    correctness: [...prior?.correctness ?? [], correct].slice(-SELECTION_CORRECTNESS_WINDOW),
    timingMs: timingMs === null ? prior?.timingMs ?? []
      : [...prior?.timingMs ?? [], timingMs].slice(-SELECTION_TIMING_WINDOW),
  };
}

export function parseSelectionEvidence(value: unknown): RecentSelectionEvidence | null {
  if (typeof value !== "object" || value === null) return null;
  const { correctness, timingMs } = value as Record<string, unknown>;
  if (!Array.isArray(correctness) || !Array.isArray(timingMs)
    || correctness.length > SELECTION_CORRECTNESS_WINDOW
    || timingMs.length > SELECTION_TIMING_WINDOW
    || correctness.some(item => typeof item !== "boolean")
    || timingMs.some(item => typeof item !== "number" || !Number.isFinite(item) || item < 0)) return null;
  return { correctness: correctness as boolean[], timingMs: timingMs as number[] };
}

export function quantile(values: readonly number[], fraction: number): number {
  if (values.length === 0) throw new RangeError("quantile requires samples");
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * fraction;
  const lower = Math.floor(position);
  const mix = position - lower;
  return ordered[lower]! * (1 - mix) + ordered[Math.ceil(position)]! * mix;
}
