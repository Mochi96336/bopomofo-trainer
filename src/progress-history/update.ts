import type { Exercise, PracticeMode, TokenId } from "../core/model.js";
import { deriveMeasurementDecisions } from "../measurement/derive-observations.js";
import type { MeasurementPolicy } from "../measurement/types.js";
import type { InteractionTrace } from "../practice/interaction-session.js";
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

export interface AppendRoundToProgressHistoryInput {
  readonly history: ProgressHistory;
  readonly exercise: Exercise;
  readonly traces: readonly InteractionTrace[];
  readonly measurementPolicy: MeasurementPolicy;
  /** The 1-based number of the round that has just been completed. */
  readonly completedRound: number;
  readonly policy?: ProgressHistoryPolicy;
}

interface RoundObservations {
  /** One entry per mapped correctness observation, in trace order. */
  readonly correct: readonly boolean[];
  readonly timings: readonly number[];
}

export function createEmptyProgressHistory(
  mode: PracticeMode,
  layoutId: string,
): ProgressHistory {
  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode,
    layoutId,
    lastCompletedRound: 0,
    keys: {},
  };
}

export function createEmptyKeyProgressHistory(tokenId: TokenId): KeyProgressHistory {
  return {
    tokenId,
    correctness: [],
    timing: [],
    partialCorrectness: { attempts: 0, errors: 0 },
    partialTiming: { samples: [] },
    totalObservations: 0,
    totalTimingSamples: 0,
  };
}

/**
 * Median of the closed bucket. Chosen over a mean because a single hesitation
 * inside a five-sample bucket would drag a mean noticeably while leaving the
 * median where the rest of the bucket actually sat, and over the aggregate's
 * exponential moving average because a history point must describe only its own
 * exposure rather than carrying every earlier sample forward.
 */
export function bucketRepresentativeTimingMs(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new RangeError("cannot summarize an empty timing bucket");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Math.round(value * 1000) / 1000;
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bounded<T>(points: readonly T[], limit: number): readonly T[] {
  return points.length <= limit ? points : points.slice(points.length - limit);
}

/**
 * Collects this round's observations per expected token, using only the
 * decisions the measurement policy already accepted. Nothing here re-decides
 * eligibility: excluded bindings, unmapped keys, modifier and repeat noise,
 * composition events, syllable starts, incorrect input, recovery input, and
 * interaction-noise-contaminated intervals are all filtered upstream.
 */
function roundObservationsByToken(
  exercise: Exercise,
  traces: readonly InteractionTrace[],
  measurementPolicy: MeasurementPolicy,
): ReadonlyMap<TokenId, RoundObservations> {
  const result = new Map<TokenId, { correct: boolean[]; timings: number[] }>();
  for (const decision of deriveMeasurementDecisions(exercise, traces, measurementPolicy)) {
    if (!decision.binding.included) continue;
    const observation = decision.binding.observation;
    const tokenId = observation.scope.tokenId;
    const bucket = result.get(tokenId) ?? { correct: [], timings: [] };
    bucket.correct.push(observation.correct);
    const timing = observation.timingMs;
    // A non-finite or negative interval can never describe an exposure; it is
    // dropped rather than allowed to poison a bucket median.
    if (timing !== null && Number.isFinite(timing) && timing >= 0) {
      bucket.timings.push(timing);
    }
    result.set(tokenId, bucket);
  }
  return result;
}

function appendCorrectness(
  entry: KeyProgressHistory,
  observations: RoundObservations,
  completedRound: number,
  policy: ProgressHistoryPolicy,
): Pick<KeyProgressHistory, "correctness" | "partialCorrectness" | "totalObservations"> {
  const points = [...entry.correctness];
  let attempts = entry.partialCorrectness.attempts;
  let errors = entry.partialCorrectness.errors;
  let total = entry.totalObservations;

  // Observations are folded one at a time, in trace order, so a round that
  // spans a bucket boundary closes exactly at the boundary regardless of how
  // many syllables the utterance happened to contain.
  for (const wasCorrect of observations.correct) {
    attempts += 1;
    total += 1;
    if (!wasCorrect) errors += 1;
    if (attempts < policy.correctnessBucketSize) continue;
    points.push({
      endingObservation: total,
      completedRound,
      attempts,
      errors,
      errorRatio: Math.round((errors / attempts) * 1e6) / 1e6,
    });
    attempts = 0;
    errors = 0;
  }

  return {
    correctness: bounded(points, policy.completedPointLimit),
    partialCorrectness: { attempts, errors },
    totalObservations: total,
  };
}

function appendTiming(
  entry: KeyProgressHistory,
  observations: RoundObservations,
  completedRound: number,
  policy: ProgressHistoryPolicy,
): Pick<KeyProgressHistory, "timing" | "partialTiming" | "totalTimingSamples"> {
  const points = [...entry.timing];
  let open = [...entry.partialTiming.samples];
  let total = entry.totalTimingSamples;

  for (const sample of observations.timings) {
    open.push(sample);
    total += 1;
    if (open.length < policy.timingBucketSize) continue;
    points.push({
      endingSample: total,
      completedRound,
      samples: open.length,
      representativeTimingMs: bucketRepresentativeTimingMs(open),
    });
    open = [];
  }

  return {
    timing: bounded(points, policy.completedPointLimit),
    partialTiming: { samples: open },
    totalTimingSamples: total,
  };
}

/**
 * Folds one completed round into bounded history.
 *
 * Pure: the same history, exercise, traces, and round number always produce the
 * same result. Rounds at or below `lastCompletedRound` are ignored, so a replay
 * caused by a reopened panel, a reload, or a re-imported backup cannot inflate
 * history.
 */
export function appendRoundToProgressHistory(
  input: AppendRoundToProgressHistoryInput,
): ProgressHistory {
  const policy = input.policy ?? PROGRESS_HISTORY_POLICY;
  validateProgressHistoryPolicy(policy);
  const { history, exercise, completedRound } = input;

  if (!Number.isInteger(completedRound) || completedRound <= 0) {
    throw new RangeError("completedRound must be a positive integer");
  }
  if (exercise.mode !== history.mode || exercise.layoutId !== history.layoutId) {
    throw new Error(
      `cannot append ${exercise.mode}/${exercise.layoutId} observations to ${history.mode}/${history.layoutId} history`,
    );
  }
  if (completedRound <= history.lastCompletedRound) return history;

  const byToken = roundObservationsByToken(
    exercise,
    input.traces,
    input.measurementPolicy,
  );
  const keys: Record<TokenId, KeyProgressHistory> = { ...history.keys };
  for (const [tokenId, observations] of byToken) {
    const entry = keys[tokenId] ?? createEmptyKeyProgressHistory(tokenId);
    keys[tokenId] = {
      ...entry,
      ...appendCorrectness(entry, observations, completedRound, policy),
      ...appendTiming(entry, observations, completedRound, policy),
    };
  }

  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: history.mode,
    layoutId: history.layoutId,
    lastCompletedRound: completedRound,
    keys: Object.fromEntries(
      Object.entries(keys).sort(([left], [right]) => codeUnitCompare(left, right)),
    ),
  };
}
