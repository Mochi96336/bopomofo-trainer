import type { PracticeMode, TokenId } from "../core/model.js";
import {
  PROGRESS_HISTORY_POLICY,
  validateProgressHistoryPolicy,
  type ProgressHistoryPolicy,
} from "./policy.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type CorrectnessTrendPoint,
  type KeyProgressHistory,
  type ProgressHistory,
  type TimingTrendPoint,
} from "./types.js";

/**
 * Upper bound on distinct keys a stored history may describe. The standard
 * layout binds far fewer tokens than this; the gate exists so an imported
 * backup cannot inject an arbitrarily large payload before token identity is
 * even checked.
 */
export const PROGRESS_HISTORY_KEY_LIMIT = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseCorrectnessPoint(
  value: unknown,
  policy: ProgressHistoryPolicy,
): CorrectnessTrendPoint | null {
  if (
    !isRecord(value)
    || !isNonNegativeInteger(value.endingObservation)
    || !isNonNegativeInteger(value.completedRound)
    || (value.completedRound as number) === 0
    || !isNonNegativeInteger(value.attempts)
    || !isNonNegativeInteger(value.errors)
    || (value.attempts as number) !== policy.correctnessBucketSize
    || (value.errors as number) > (value.attempts as number)
    || (value.endingObservation as number) < (value.attempts as number)
    || !isFiniteNonNegative(value.errorRatio)
    || (value.errorRatio as number) > 1
  ) return null;
  // The ratio is derived, so a stored value that disagrees with its own counts
  // is a corrupted or hand-edited record rather than something to recompute.
  const expected = Math.round(
    ((value.errors as number) / (value.attempts as number)) * 1e6,
  ) / 1e6;
  if (Math.abs((value.errorRatio as number) - expected) > 1e-6) return null;
  return {
    endingObservation: value.endingObservation as number,
    completedRound: value.completedRound as number,
    attempts: value.attempts as number,
    errors: value.errors as number,
    errorRatio: expected,
  };
}

function parseTimingPoint(
  value: unknown,
  policy: ProgressHistoryPolicy,
): TimingTrendPoint | null {
  if (
    !isRecord(value)
    || !isNonNegativeInteger(value.endingSample)
    || !isNonNegativeInteger(value.completedRound)
    || (value.completedRound as number) === 0
    || !isNonNegativeInteger(value.samples)
    || (value.samples as number) !== policy.timingBucketSize
    || (value.endingSample as number) < (value.samples as number)
    || !isFiniteNonNegative(value.representativeTimingMs)
  ) return null;
  return {
    endingSample: value.endingSample as number,
    completedRound: value.completedRound as number,
    samples: value.samples as number,
    representativeTimingMs: value.representativeTimingMs as number,
  };
}

function parseSeries<T>(
  value: unknown,
  policy: ProgressHistoryPolicy,
  parsePoint: (candidate: unknown) => T | null,
  order: (point: T) => { readonly ending: number; readonly round: number },
): readonly T[] | null {
  if (!Array.isArray(value) || value.length > policy.completedPointLimit) return null;
  const points: T[] = [];
  for (const candidate of value) {
    const point = parsePoint(candidate);
    if (point === null) return null;
    const previous = points.at(-1);
    if (previous !== undefined) {
      const before = order(previous);
      const current = order(point);
      // Points are cumulative slices of the same series: they must advance and
      // must never repeat, so duplicates and reordered arrays are rejected.
      if (current.ending <= before.ending || current.round < before.round) return null;
    }
    points.push(point);
  }
  return points;
}

function parseKeyProgressHistory(
  tokenId: TokenId,
  value: unknown,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
): KeyProgressHistory | null {
  if (!isRecord(value) || !isRecord(value.partialCorrectness)) return null;
  const partialCorrectness = value.partialCorrectness;
  const partialTiming = value.partialTiming;
  if (
    !isNonNegativeInteger(partialCorrectness.attempts)
    || !isNonNegativeInteger(partialCorrectness.errors)
    || (partialCorrectness.errors as number) > (partialCorrectness.attempts as number)
    || (partialCorrectness.attempts as number) >= policy.correctnessBucketSize
    || !isRecord(partialTiming)
    || !Array.isArray(partialTiming.samples)
    || partialTiming.samples.length >= policy.timingBucketSize
    || partialTiming.samples.some((sample) => !isFiniteNonNegative(sample))
    || !isNonNegativeInteger(value.totalObservations)
    || !isNonNegativeInteger(value.totalTimingSamples)
  ) return null;

  const correctness = parseSeries(
    value.correctness,
    policy,
    (candidate) => parseCorrectnessPoint(candidate, policy),
    (point) => ({ ending: point.endingObservation, round: point.completedRound }),
  );
  const timing = parseSeries(
    value.timing,
    policy,
    (candidate) => parseTimingPoint(candidate, policy),
    (point) => ({ ending: point.endingSample, round: point.completedRound }),
  );
  if (correctness === null || timing === null) return null;

  const latestCorrectness = correctness.at(-1);
  const latestTiming = timing.at(-1);
  if (
    (latestCorrectness?.completedRound ?? 0) > lastCompletedRound
    || (latestTiming?.completedRound ?? 0) > lastCompletedRound
  ) return null;
  // A total is exactly the newest closed point's cumulative index plus the open
  // bucket, even after the oldest points have been dropped by the history
  // limit. Anything else was not produced by the append path.
  if (
    (value.totalObservations as number)
      !== (latestCorrectness?.endingObservation ?? 0) + (partialCorrectness.attempts as number)
    || (value.totalTimingSamples as number)
      !== (latestTiming?.endingSample ?? 0) + partialTiming.samples.length
    || (value.totalTimingSamples as number) > (value.totalObservations as number)
  ) return null;

  return {
    tokenId,
    correctness,
    timing,
    partialCorrectness: {
      attempts: partialCorrectness.attempts as number,
      errors: partialCorrectness.errors as number,
    },
    partialTiming: { samples: partialTiming.samples as number[] },
    totalObservations: value.totalObservations as number,
    totalTimingSamples: value.totalTimingSamples as number,
  };
}

export function serializeProgressHistory(history: ProgressHistory): string {
  return JSON.stringify(history);
}

export function parseProgressHistory(
  source: string,
  expectedMode: PracticeMode,
  expectedLayoutId: string,
  validTokens: ReadonlySet<string>,
  policy: ProgressHistoryPolicy = PROGRESS_HISTORY_POLICY,
): ProgressHistory | null {
  validateProgressHistoryPolicy(policy);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== PROGRESS_HISTORY_SCHEMA_VERSION
    || parsed.mode !== expectedMode
    || parsed.layoutId !== expectedLayoutId
    || !isNonNegativeInteger(parsed.lastCompletedRound)
    || !isRecord(parsed.keys)
  ) return null;

  const entries = Object.entries(parsed.keys);
  if (entries.length > PROGRESS_HISTORY_KEY_LIMIT) return null;

  const keys: [string, KeyProgressHistory][] = [];
  for (const [tokenId, candidate] of entries) {
    if (!validTokens.has(tokenId)) return null;
    const entry = parseKeyProgressHistory(
      tokenId,
      candidate,
      policy,
      parsed.lastCompletedRound as number,
    );
    if (entry === null) return null;
    keys.push([tokenId, entry]);
  }

  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: expectedMode,
    layoutId: expectedLayoutId,
    lastCompletedRound: parsed.lastCompletedRound as number,
    keys: Object.fromEntries(
      keys.sort(([left], [right]) => codeUnitCompare(left, right)),
    ),
  };
}
