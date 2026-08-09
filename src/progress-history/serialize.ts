import type { PracticeMode, TokenId } from "../core/model.js";
import {
  coordinationAggregateKey,
  immediateHandAggregateKey,
  sameHandRevisitAggregateKey,
  toneCommitAggregateKey,
  type CoordinationAggregateScope,
  type ImmediateHandAggregateScope,
  type SameHandRevisitAggregateScope,
  type ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";
import type {
  CoordinationBodyShape,
  CoordinationHandShape,
  ExplicitHand,
} from "../measurement-v2/types.js";
import {
  PROGRESS_HISTORY_POLICY,
  validateProgressHistoryPolicy,
  type ProgressHistoryPolicy,
} from "./policy.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type CorrectnessTrendPoint,
  type KeyProgressHistory,
  type MotorProgressHistory,
  type MotorTimingProgressHistory,
  type ProgressHistory,
  type TimingTrendPoint,
} from "./types.js";

const LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_2 = 2;
const LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_3 = 3;
const LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_4 = 4;
const LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5 = 5;
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
      if (current.ending <= before.ending || current.round < before.round) return null;
    }
    points.push(point);
  }
  return points;
}

function parsePartialTimingState(
  value: Record<string, unknown>,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
): {
  readonly timing: readonly TimingTrendPoint[];
  readonly partialTiming: { readonly samples: readonly number[] };
  readonly totalTimingSamples: number;
} | null {
  if (
    !isRecord(value.partialTiming)
    || !Array.isArray(value.partialTiming.samples)
    || value.partialTiming.samples.length >= policy.timingBucketSize
    || value.partialTiming.samples.some((sample) => !isFiniteNonNegative(sample))
    || !isNonNegativeInteger(value.totalTimingSamples)
  ) return null;
  const timing = parseSeries(
    value.timing,
    policy,
    (candidate) => parseTimingPoint(candidate, policy),
    (point) => ({ ending: point.endingSample, round: point.completedRound }),
  );
  if (timing === null || (timing.at(-1)?.completedRound ?? 0) > lastCompletedRound) return null;
  if (
    (value.totalTimingSamples as number)
      !== (timing.at(-1)?.endingSample ?? 0) + value.partialTiming.samples.length
  ) return null;
  return {
    timing,
    partialTiming: { samples: value.partialTiming.samples as number[] },
    totalTimingSamples: value.totalTimingSamples as number,
  };
}

function parseKeyProgressHistory(
  tokenId: TokenId,
  value: unknown,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
): KeyProgressHistory | null {
  if (!isRecord(value) || !isRecord(value.partialCorrectness)) return null;
  const partialCorrectness = value.partialCorrectness;
  if (
    !isNonNegativeInteger(partialCorrectness.attempts)
    || !isNonNegativeInteger(partialCorrectness.errors)
    || (partialCorrectness.errors as number) > (partialCorrectness.attempts as number)
    || (partialCorrectness.attempts as number) >= policy.correctnessBucketSize
    || !isNonNegativeInteger(value.totalObservations)
  ) return null;

  const correctness = parseSeries(
    value.correctness,
    policy,
    (candidate) => parseCorrectnessPoint(candidate, policy),
    (point) => ({ ending: point.endingObservation, round: point.completedRound }),
  );
  const timingState = parsePartialTimingState(value, policy, lastCompletedRound);
  if (correctness === null || timingState === null) return null;

  const latestCorrectness = correctness.at(-1);
  if ((latestCorrectness?.completedRound ?? 0) > lastCompletedRound) return null;
  if (
    (value.totalObservations as number)
      !== (latestCorrectness?.endingObservation ?? 0) + (partialCorrectness.attempts as number)
    || timingState.totalTimingSamples > (value.totalObservations as number)
  ) return null;

  return {
    tokenId,
    correctness,
    timing: timingState.timing,
    partialCorrectness: {
      attempts: partialCorrectness.attempts as number,
      errors: partialCorrectness.errors as number,
    },
    partialTiming: timingState.partialTiming,
    totalObservations: value.totalObservations as number,
    totalTimingSamples: timingState.totalTimingSamples,
  };
}

function explicitHand(value: unknown): value is ExplicitHand {
  return value === "left" || value === "right";
}

function handShape(value: unknown): value is CoordinationHandShape {
  return value === "left-only"
    || value === "right-only"
    || value === "mixed"
    || value === "unknown";
}

function bodyShape(value: unknown): value is CoordinationBodyShape {
  return value === "initial-medial"
    || value === "initial-final"
    || value === "medial-final"
    || value === "initial-medial-final";
}

function parseCoordinationScope(value: unknown): CoordinationAggregateScope | null {
  if (!isRecord(value) || !bodyShape(value.bodyShape)) return null;
  return { bodyShape: value.bodyShape };
}

interface LegacyCoordinationScope {
  readonly bodySize: "2" | "3" | "4+";
  readonly handShape: CoordinationHandShape;
}

function parseLegacyCoordinationScope(
  value: unknown,
  allowFourPlus: boolean,
): LegacyCoordinationScope | null {
  if (!isRecord(value) || !handShape(value.handShape)) return null;
  if (value.bodySize !== "2" && value.bodySize !== "3"
    && !(allowFourPlus && value.bodySize === "4+")) return null;
  return { bodySize: value.bodySize, handShape: value.handShape };
}

function legacyCoordinationKey(scope: LegacyCoordinationScope): string {
  return JSON.stringify(["coordination", scope.bodySize, scope.handShape]);
}

function parseImmediateHandScope(value: unknown): ImmediateHandAggregateScope | null {
  if (!isRecord(value) || !explicitHand(value.fromHand) || !explicitHand(value.toHand)) return null;
  return { fromHand: value.fromHand, toHand: value.toHand };
}

function parseSameHandScope(value: unknown): SameHandRevisitAggregateScope | null {
  if (!isRecord(value) || !explicitHand(value.hand) || typeof value.oppositeHandIntervened !== "boolean") {
    return null;
  }
  return { hand: value.hand, oppositeHandIntervened: value.oppositeHandIntervened };
}

function parseToneScope(
  value: unknown,
  validTokens: ReadonlySet<string>,
): ToneCommitAggregateScope | null {
  if (!isRecord(value) || typeof value.toneToken !== "string") return null;
  if (!value.toneToken.startsWith("tone:") || !validTokens.has(value.toneToken)) return null;
  return { toneToken: value.toneToken };
}

function parseMotorTimingHistory<Scope>(
  value: unknown,
  scope: Scope,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
): MotorTimingProgressHistory<Scope> | null {
  if (!isRecord(value)) return null;
  const timingState = parsePartialTimingState(value, policy, lastCompletedRound);
  if (timingState === null) return null;
  return { scope, ...timingState };
}

function parseMotorFamily<Scope>(
  value: unknown,
  parseScope: (value: unknown) => Scope | null,
  keyOf: (scope: Scope) => string,
  maximumKeys: number,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
): Readonly<Record<string, MotorTimingProgressHistory<Scope>>> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > maximumKeys) return null;
  const parsed: [string, MotorTimingProgressHistory<Scope>][] = [];
  for (const [storedKey, candidate] of entries) {
    if (!isRecord(candidate)) return null;
    const scope = parseScope(candidate.scope);
    if (scope === null || keyOf(scope) !== storedKey) return null;
    const history = parseMotorTimingHistory(candidate, scope, policy, lastCompletedRound);
    if (history === null) return null;
    parsed.push([storedKey, history]);
  }
  return Object.fromEntries(
    parsed.sort(([left], [right]) => codeUnitCompare(left, right)),
  );
}

function validateLegacyCoordination(
  value: unknown,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
  allowFourPlus: boolean,
): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  const maximum = allowFourPlus ? 12 : 8;
  if (entries.length > maximum) return false;
  for (const [storedKey, candidate] of entries) {
    if (!isRecord(candidate)) return false;
    const scope = parseLegacyCoordinationScope(candidate.scope, allowFourPlus);
    if (scope === null || legacyCoordinationKey(scope) !== storedKey) return false;
    if (parseMotorTimingHistory(candidate, scope, policy, lastCompletedRound) === null) return false;
  }
  return true;
}

function emptyMotorProgressHistory(): MotorProgressHistory {
  return {
    coordination: {},
    immediateHands: {},
    sameHandRevisits: {},
    toneCommits: {},
  };
}

function parseMotorProgressHistory(
  value: unknown,
  validTokens: ReadonlySet<string>,
  policy: ProgressHistoryPolicy,
  lastCompletedRound: number,
  coordinationSchema: "current" | "legacy-4" | "legacy-3",
  sameHandSchema: "current" | "legacy",
): MotorProgressHistory | null {
  if (!isRecord(value)) return null;

  let coordination: MotorProgressHistory["coordination"] | null;
  if (coordinationSchema === "current") {
    coordination = parseMotorFamily(
      value.coordination,
      parseCoordinationScope,
      coordinationAggregateKey,
      4,
      policy,
      lastCompletedRound,
    );
  } else {
    const validLegacy = validateLegacyCoordination(
      value.coordination,
      policy,
      lastCompletedRound,
      coordinationSchema === "legacy-3",
    );
    coordination = validLegacy ? {} : null;
  }

  const immediateHands = parseMotorFamily(
    value.immediateHands,
    parseImmediateHandScope,
    immediateHandAggregateKey,
    4,
    policy,
    lastCompletedRound,
  );
  const parsedSameHandRevisits = parseMotorFamily(
    value.sameHandRevisits,
    parseSameHandScope,
    sameHandRevisitAggregateKey,
    4,
    policy,
    lastCompletedRound,
  );
  const toneCommits = parseMotorFamily(
    value.toneCommits,
    (scope) => parseToneScope(scope, validTokens),
    toneCommitAggregateKey,
    Math.max(1, [...validTokens].filter((token) => token.startsWith("tone:")).length),
    policy,
    lastCompletedRound,
  );
  if (coordination === null || immediateHands === null
    || parsedSameHandRevisits === null || toneCommits === null) return null;
  const sameHandRevisits = sameHandSchema === "current" ? parsedSameHandRevisits : {};
  return { coordination, immediateHands, sameHandRevisits, toneCommits };
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
  if (!isRecord(parsed)) return null;
  const schemaVersion = parsed.schemaVersion;
  if (
    schemaVersion !== PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_4
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_3
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_2
  ) return null;
  if (
    parsed.mode !== expectedMode
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

  let motor: MotorProgressHistory | null;
  if (schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_2) {
    motor = emptyMotorProgressHistory();
  } else {
    const coordinationSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5
      ? "current"
      : schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_4
        ? "legacy-4"
        : "legacy-3";
    const sameHandSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      ? "current"
      : "legacy";
    motor = parseMotorProgressHistory(
      parsed.motor,
      validTokens,
      policy,
      parsed.lastCompletedRound as number,
      coordinationSchema,
      sameHandSchema,
    );
  }
  if (motor === null) return null;

  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: expectedMode,
    layoutId: expectedLayoutId,
    lastCompletedRound: parsed.lastCompletedRound as number,
    keys: Object.fromEntries(
      keys.sort(([left], [right]) => codeUnitCompare(left, right)),
    ),
    motor,
  };
}
