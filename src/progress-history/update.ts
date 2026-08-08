import type { Exercise, PracticeMode, TokenId } from "../core/model.js";
import { deriveMeasurementObservationsV2 } from "../measurement-v2/derive-observations.js";
import type { InteractionTraceV2 } from "../practice/interaction-session-v2.js";
import {
  PROGRESS_HISTORY_POLICY,
  validateProgressHistoryPolicy,
  type ProgressHistoryPolicy,
} from "./policy.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type KeyProgressHistory,
  type ProgressHistory,
} from "./types.js";

export interface AppendRoundToProgressHistoryInput {
  readonly history: ProgressHistory;
  readonly exercise: Exercise;
  readonly traces: readonly InteractionTraceV2[];
  readonly completedRound: number;
  readonly policy?: ProgressHistoryPolicy;
}

interface RoundObservations {
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

function roundObservationsByToken(
  exercise: Exercise,
  traces: readonly InteractionTraceV2[],
): ReadonlyMap<TokenId, RoundObservations> {
  const result = new Map<TokenId, { correct: boolean[]; timings: number[] }>();
  for (const observation of deriveMeasurementObservationsV2(exercise, traces).bindings) {
    const tokenId = observation.scope.tokenId;
    const bucket = result.get(tokenId) ?? { correct: [], timings: [] };
    bucket.correct.push(observation.correct);
    const timing = observation.timingMs;
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

  const byToken = roundObservationsByToken(exercise, input.traces);
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
