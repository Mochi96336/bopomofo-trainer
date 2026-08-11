import type { Exercise, PracticeMode, TokenId } from "../core/model.js";
import {
  coordinationAggregateKey,
  coordinationBodySizeBucket,
  immediateHandAggregateKey,
  sameHandRevisitAggregateKey,
  toneCommitAggregateKey,
  type CoordinationAggregateScope,
  type ImmediateHandAggregateScope,
  type SameHandRevisitAggregateScope,
  type ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";
import { deriveMeasurementObservationsV2 } from "../measurement-v2/derive-observations.js";
import {
  coordinationTimingSample,
  immediateHandTimingSample,
  sameHandRevisitTimingSample,
  toneCommitTimingSample,
} from "../measurement-v2/timing-eligibility.js";
import type { MeasurementObservationsV2 } from "../measurement-v2/types.js";
import type { InteractionTraceV2 } from "../practice/interaction-session-v2.js";
import {
  PROGRESS_HISTORY_POLICY,
  validateProgressHistoryPolicy,
  type ProgressHistoryPolicy,
} from "./policy.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type KeyProgressHistory,
  type MotorProgressHistory,
  type MotorTimingProgressHistory,
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

interface TimingHistoryState {
  readonly timing: MotorTimingProgressHistory<unknown>["timing"];
  readonly partialTiming: MotorTimingProgressHistory<unknown>["partialTiming"];
  readonly totalTimingSamples: number;
}

interface MotorRoundSamples<Scope> {
  readonly scope: Scope;
  readonly samples: number[];
}

export function createEmptyMotorProgressHistory(): MotorProgressHistory {
  return {
    coordination: {},
    immediateHands: {},
    sameHandRevisits: {},
    toneCommits: {},
  };
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
    motor: createEmptyMotorProgressHistory(),
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

function createEmptyMotorTimingProgressHistory<Scope>(
  scope: Scope,
): MotorTimingProgressHistory<Scope> {
  return {
    scope,
    timing: [],
    partialTiming: { samples: [] },
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
  observations: MeasurementObservationsV2,
): ReadonlyMap<TokenId, RoundObservations> {
  const result = new Map<TokenId, { correct: boolean[]; timings: number[] }>();
  for (const observation of observations.bindings) {
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

function appendTimingState(
  entry: TimingHistoryState,
  samples: readonly number[],
  completedRound: number,
  policy: ProgressHistoryPolicy,
): TimingHistoryState {
  const points = [...entry.timing];
  let open = [...entry.partialTiming.samples];
  let total = entry.totalTimingSamples;

  for (const sample of samples) {
    if (!Number.isFinite(sample) || sample < 0) continue;
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

function appendTiming(
  entry: KeyProgressHistory,
  observations: RoundObservations,
  completedRound: number,
  policy: ProgressHistoryPolicy,
): Pick<KeyProgressHistory, "timing" | "partialTiming" | "totalTimingSamples"> {
  return appendTimingState(entry, observations.timings, completedRound, policy);
}

function pushMotorSample<Scope>(
  target: Map<string, MotorRoundSamples<Scope>>,
  key: string,
  scope: Scope,
  sample: number | null,
): void {
  if (sample === null || !Number.isFinite(sample) || sample < 0) return;
  const current = target.get(key) ?? { scope, samples: [] };
  current.samples.push(sample);
  target.set(key, current);
}

function motorSamples(
  observations: MeasurementObservationsV2,
): {
  readonly coordination: ReadonlyMap<string, MotorRoundSamples<CoordinationAggregateScope>>;
  readonly immediateHands: ReadonlyMap<string, MotorRoundSamples<ImmediateHandAggregateScope>>;
  readonly sameHandRevisits: ReadonlyMap<string, MotorRoundSamples<SameHandRevisitAggregateScope>>;
  readonly toneCommits: ReadonlyMap<string, MotorRoundSamples<ToneCommitAggregateScope>>;
} {
  const coordination = new Map<string, MotorRoundSamples<CoordinationAggregateScope>>();
  for (const observation of observations.coordination) {
    const scope: CoordinationAggregateScope = {
      bodySize: coordinationBodySizeBucket(observation.bodySize),
      handShape: observation.handShape,
    };
    pushMotorSample(
      coordination,
      coordinationAggregateKey(scope),
      scope,
      coordinationTimingSample(observation),
    );
  }

  const immediateHands = new Map<string, MotorRoundSamples<ImmediateHandAggregateScope>>();
  for (const observation of observations.immediateHands) {
    const scope: ImmediateHandAggregateScope = {
      fromHand: observation.fromHand,
      toHand: observation.toHand,
    };
    pushMotorSample(
      immediateHands,
      immediateHandAggregateKey(scope),
      scope,
      immediateHandTimingSample(observation),
    );
  }

  const sameHandRevisits = new Map<string, MotorRoundSamples<SameHandRevisitAggregateScope>>();
  for (const observation of observations.sameHandRevisits) {
    const scope: SameHandRevisitAggregateScope = {
      hand: observation.hand,
      oppositeHandIntervened: observation.oppositeHandEventsBetween > 0,
    };
    pushMotorSample(
      sameHandRevisits,
      sameHandRevisitAggregateKey(scope),
      scope,
      sameHandRevisitTimingSample(observation),
    );
  }

  const toneCommits = new Map<string, MotorRoundSamples<ToneCommitAggregateScope>>();
  for (const observation of observations.toneCommits) {
    const scope: ToneCommitAggregateScope = { toneToken: observation.toneToken };
    pushMotorSample(
      toneCommits,
      toneCommitAggregateKey(scope),
      scope,
      toneCommitTimingSample(observation),
    );
  }

  return { coordination, immediateHands, sameHandRevisits, toneCommits };
}

function appendMotorFamily<Scope>(
  prior: Readonly<Record<string, MotorTimingProgressHistory<Scope>>>,
  roundSamples: ReadonlyMap<string, MotorRoundSamples<Scope>>,
  completedRound: number,
  policy: ProgressHistoryPolicy,
): Readonly<Record<string, MotorTimingProgressHistory<Scope>>> {
  const next: Record<string, MotorTimingProgressHistory<Scope>> = { ...prior };
  for (const [key, incoming] of roundSamples) {
    const entry = next[key] ?? createEmptyMotorTimingProgressHistory(incoming.scope);
    next[key] = {
      ...entry,
      ...appendTimingState(entry, incoming.samples, completedRound, policy),
    };
  }
  return Object.fromEntries(
    Object.entries(next).sort(([left], [right]) => codeUnitCompare(left, right)),
  );
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

  const observations = deriveMeasurementObservationsV2(exercise, input.traces);
  const byToken = roundObservationsByToken(observations);
  const keys: Record<TokenId, KeyProgressHistory> = { ...history.keys };
  for (const [tokenId, tokenObservations] of byToken) {
    const entry = keys[tokenId] ?? createEmptyKeyProgressHistory(tokenId);
    keys[tokenId] = {
      ...entry,
      ...appendCorrectness(entry, tokenObservations, completedRound, policy),
      ...appendTiming(entry, tokenObservations, completedRound, policy),
    };
  }

  const roundMotor = motorSamples(observations);
  const motor: MotorProgressHistory = {
    coordination: appendMotorFamily(
      history.motor.coordination,
      roundMotor.coordination,
      completedRound,
      policy,
    ),
    immediateHands: appendMotorFamily(
      history.motor.immediateHands,
      roundMotor.immediateHands,
      completedRound,
      policy,
    ),
    sameHandRevisits: appendMotorFamily(
      history.motor.sameHandRevisits,
      roundMotor.sameHandRevisits,
      completedRound,
      policy,
    ),
    toneCommits: appendMotorFamily(
      history.motor.toneCommits,
      roundMotor.toneCommits,
      completedRound,
      policy,
    ),
  };

  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: history.mode,
    layoutId: history.layoutId,
    lastCompletedRound: completedRound,
    keys: Object.fromEntries(
      Object.entries(keys).sort(([left], [right]) => codeUnitCompare(left, right)),
    ),
    motor,
  };
}
