import type { PracticeMode } from "../core/model.js";
import {
  LEGACY_MEASUREMENT_V2_POLICY_VERSION,
  MEASUREMENT_V2_POLICY_VERSION,
  PREVIOUS_MEASUREMENT_V2_POLICY_VERSION,
  bindingAggregateKey,
  confusionAggregateKey,
  coordinationAggregateKey,
  immediateHandAggregateKey,
  immediateTokenAggregateKey,
  inputOrderPermutationAggregateKey,
  inputOrderPositionAggregateKey,
  sameHandRevisitAggregateKey,
  toneCommitAggregateKey,
  type BindingAggregateV2,
  type BodyPositionBucket,
  type ConfusionAggregateV2,
  type CoordinationAggregateScope,
  type CoordinationBodySizeBucket,
  type ImmediateHandAggregateScope,
  type ImmediateTokenAggregateScope,
  type InputOrderPermutationAggregate,
  type InputOrderPermutationAggregateScope,
  type InputOrderPositionAggregate,
  type InputOrderPositionAggregateScope,
  type MeasurementSummaryV2,
  type MotorTimingAggregate,
  type SameHandRevisitAggregateScope,
  type ToneCommitAggregateScope,
} from "./aggregate.js";
import type {
  CoordinationBodyShape,
  CoordinationHandShape,
  ExplicitHand,
  ThreePartInputOrderPermutation,
} from "./types.js";

const CURRENT_STRATEGY_KEY_LIMIT = 13; // 2-part 2×2 + 3-part 3×3.
const THREE_PART_PERMUTATION_KEY_LIMIT = 6;
const LEGACY_STRATEGY_KEY_LIMIT = 27;
const CURRENT_COORDINATION_KEY_LIMIT = 4;
const PREVIOUS_COORDINATION_KEY_LIMIT = 8; // 2 body sizes × 4 legacy hand shapes.
const LEGACY_COORDINATION_KEY_LIMIT = 12; // aggregate-1 also admitted 4+.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function finiteNonNegativeOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function validTimingPair(
  timingSamples: number,
  current: number | null,
  best: number | null,
): boolean {
  return timingSamples === 0
    ? current === null && best === null
    : current !== null && best !== null;
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

function coordinationBodyShape(value: unknown): value is CoordinationBodyShape {
  return value === "initial-medial"
    || value === "initial-final"
    || value === "medial-final"
    || value === "initial-medial-final";
}

function bodySizeBucket(value: unknown): value is CoordinationBodySizeBucket {
  return value === "2" || value === "3";
}

function bodyPosition(value: unknown): value is BodyPositionBucket {
  return value === "first" || value === "middle" || value === "last";
}

function threePartInputOrderPermutation(value: unknown): value is ThreePartInputOrderPermutation {
  return value === "first-middle-last"
    || value === "middle-first-last"
    || value === "first-last-middle"
    || value === "middle-last-first"
    || value === "last-first-middle"
    || value === "last-middle-first";
}

function parseBinding(
  value: unknown,
  mode: PracticeMode,
  layoutId: string,
  validTokens: ReadonlySet<string>,
): BindingAggregateV2 | null {
  if (!isRecord(value) || !isRecord(value.scope)) return null;
  const tokenId = value.scope.tokenId;
  const current = finiteNonNegativeOrNull(value.currentTimeToTypeMs);
  const best = finiteNonNegativeOrNull(value.bestTimeToTypeMs);
  if (
    value.scope.mode !== mode
    || value.scope.layoutId !== layoutId
    || typeof tokenId !== "string"
    || !validTokens.has(tokenId)
    || !isNonNegativeInteger(value.attempts)
    || !isNonNegativeInteger(value.errors)
    || !isNonNegativeInteger(value.timingSamples)
    || (value.errors as number) > (value.attempts as number)
    || (value.timingSamples as number) > (value.attempts as number)
    || current === undefined
    || best === undefined
    || !validTimingPair(value.timingSamples as number, current, best)
  ) return null;
  return {
    scope: { mode, layoutId, tokenId },
    attempts: value.attempts as number,
    errors: value.errors as number,
    timingSamples: value.timingSamples as number,
    currentTimeToTypeMs: current,
    bestTimeToTypeMs: best,
  };
}

function parseConfusion(
  value: unknown,
  mode: PracticeMode,
  layoutId: string,
  validTokens: ReadonlySet<string>,
): ConfusionAggregateV2 | null {
  if (!isRecord(value)) return null;
  const expectedToken = value.expectedToken;
  const actualToken = value.actualToken;
  if (
    value.mode !== mode
    || value.layoutId !== layoutId
    || typeof expectedToken !== "string"
    || typeof actualToken !== "string"
    || !validTokens.has(expectedToken)
    || !validTokens.has(actualToken)
    || expectedToken === actualToken
    || !isNonNegativeInteger(value.occurrences)
    || value.occurrences === 0
  ) return null;
  return {
    mode,
    layoutId,
    expectedToken,
    actualToken,
    occurrences: value.occurrences as number,
  };
}

function parseInputOrderPositionScope(value: unknown): InputOrderPositionAggregateScope | null {
  if (!isRecord(value)
    || !bodySizeBucket(value.bodySize)
    || !bodyPosition(value.canonicalPosition)
    || !bodyPosition(value.acceptedPosition)) return null;
  if (value.bodySize === "2"
    && (value.canonicalPosition === "middle" || value.acceptedPosition === "middle")) return null;
  return {
    bodySize: value.bodySize,
    canonicalPosition: value.canonicalPosition,
    acceptedPosition: value.acceptedPosition,
  };
}

function parseInputOrderPosition(value: unknown): InputOrderPositionAggregate | null {
  if (!isRecord(value)) return null;
  const scope = parseInputOrderPositionScope(value.scope);
  if (scope === null || !isNonNegativeInteger(value.observations) || value.observations === 0) {
    return null;
  }
  return { scope, observations: value.observations as number };
}

function parseInputOrderPermutationScope(value: unknown): InputOrderPermutationAggregateScope | null {
  if (!isRecord(value)
    || value.bodySize !== "3"
    || !threePartInputOrderPermutation(value.permutation)) return null;
  return { bodySize: "3", permutation: value.permutation };
}

function parseInputOrderPermutation(value: unknown): InputOrderPermutationAggregate | null {
  if (!isRecord(value)) return null;
  const scope = parseInputOrderPermutationScope(value.scope);
  if (scope === null || !isNonNegativeInteger(value.observations) || value.observations === 0) {
    return null;
  }
  return { scope, observations: value.observations as number };
}

function parseMotor<Scope>(
  value: unknown,
  parseScope: (value: unknown) => Scope | null,
): MotorTimingAggregate<Scope> | null {
  if (!isRecord(value)) return null;
  const scope = parseScope(value.scope);
  const current = finiteNonNegativeOrNull(value.currentTimeToTypeMs);
  const best = finiteNonNegativeOrNull(value.bestTimeToTypeMs);
  if (
    scope === null
    || !isNonNegativeInteger(value.observations)
    || !isNonNegativeInteger(value.timingSamples)
    || (value.timingSamples as number) > (value.observations as number)
    || current === undefined
    || best === undefined
    || !validTimingPair(value.timingSamples as number, current, best)
  ) return null;
  return {
    scope,
    observations: value.observations as number,
    timingSamples: value.timingSamples as number,
    currentTimeToTypeMs: current,
    bestTimeToTypeMs: best,
  };
}

function parseCoordinationScope(value: unknown): CoordinationAggregateScope | null {
  if (!isRecord(value) || !coordinationBodyShape(value.bodyShape)) return null;
  return { bodyShape: value.bodyShape };
}

interface LegacyCoordinationScope {
  readonly bodySize: "2" | "3" | "4+";
  readonly handShape: CoordinationHandShape;
}

function parseLegacyCoordinationScope(
  value: unknown,
  allowImpossibleFourPlus: boolean,
): LegacyCoordinationScope | null {
  if (!isRecord(value) || !handShape(value.handShape)) return null;
  if (value.bodySize !== "2" && value.bodySize !== "3"
    && !(allowImpossibleFourPlus && value.bodySize === "4+")) return null;
  return { bodySize: value.bodySize, handShape: value.handShape };
}

function legacyCoordinationKey(scope: LegacyCoordinationScope): string {
  return JSON.stringify(["coordination", scope.bodySize, scope.handShape]);
}

function validateLegacyCoordinationRecord(
  value: unknown,
  allowImpossibleFourPlus: boolean,
): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  const limit = allowImpossibleFourPlus
    ? LEGACY_COORDINATION_KEY_LIMIT
    : PREVIOUS_COORDINATION_KEY_LIMIT;
  if (entries.length > limit) return false;
  for (const [storedKey, candidate] of entries) {
    const aggregate = parseMotor(
      candidate,
      (scope) => parseLegacyCoordinationScope(scope, allowImpossibleFourPlus),
    );
    if (aggregate === null || legacyCoordinationKey(aggregate.scope) !== storedKey) return false;
  }
  return true;
}

function parseImmediateTokenScope(
  value: unknown,
  validTokens: ReadonlySet<string>,
): ImmediateTokenAggregateScope | null {
  if (!isRecord(value)
    || typeof value.fromToken !== "string"
    || typeof value.toToken !== "string"
    || !validTokens.has(value.fromToken)
    || !validTokens.has(value.toToken)) return null;
  return { fromToken: value.fromToken, toToken: value.toToken };
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

function parseRecord<T>(
  value: unknown,
  parseValue: (value: unknown) => T | null,
  keyOf: (value: T) => string,
  maximumKeys: number | null = null,
): Readonly<Record<string, T>> | null {
  if (!isRecord(value)) return null;
  const entries: [string, T][] = [];
  for (const [storedKey, candidate] of Object.entries(value)) {
    const parsed = parseValue(candidate);
    if (parsed === null || keyOf(parsed) !== storedKey) return null;
    entries.push([storedKey, parsed]);
  }
  if (maximumKeys !== null && entries.length > maximumKeys) return null;
  return Object.fromEntries(entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

/** Aggregate-1 admitted a structurally impossible 4+ strategy bucket. */
function migrateLegacyStrategyRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > LEGACY_STRATEGY_KEY_LIMIT) return null;
  const kept: [string, unknown][] = [];
  for (const [storedKey, candidate] of entries) {
    if (!isRecord(candidate) || !isRecord(candidate.scope)) {
      kept.push([storedKey, candidate]);
      continue;
    }
    if (candidate.scope.bodySize !== "4+") {
      kept.push([storedKey, candidate]);
      continue;
    }
    const expectedKey = JSON.stringify([
      "input-order-position",
      "4+",
      candidate.scope.canonicalPosition,
      candidate.scope.acceptedPosition,
    ]);
    if (storedKey !== expectedKey) return null;
  }
  return Object.fromEntries(kept);
}

export function parseMeasurementSummaryV2(
  value: unknown,
  mode: PracticeMode,
  layoutId: string,
  validTokens: ReadonlySet<string>,
): MeasurementSummaryV2 | null {
  if (!isRecord(value)
    || (value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== PREVIOUS_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== LEGACY_MEASUREMENT_V2_POLICY_VERSION)
    || !isRecord(value.semantic)
    || !isRecord(value.motor)
    || !isNonNegativeInteger(value.semantic.ambiguousErrors)
    || !isNonNegativeInteger(value.semantic.duplicateComponents)
    || !isNonNegativeInteger(value.semantic.prematureTones)) return null;

  const aggregate1 = value.policyVersion === LEGACY_MEASUREMENT_V2_POLICY_VERSION;
  const previousCoordination = value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION;
  const bindings = parseRecord(
    value.semantic.bindings,
    (candidate) => parseBinding(candidate, mode, layoutId, validTokens),
    (aggregate) => bindingAggregateKey(aggregate.scope),
  );
  const confusions = parseRecord(
    value.semantic.confusions,
    (candidate) => parseConfusion(candidate, mode, layoutId, validTokens),
    (aggregate) => confusionAggregateKey(
      aggregate.mode,
      aggregate.layoutId,
      aggregate.expectedToken,
      aggregate.actualToken,
    ),
  );

  const strategy = value.strategy === undefined
    ? { inputOrderPositions: {}, inputOrderPermutations: {} }
    : value.strategy;
  if (!isRecord(strategy)) return null;
  const strategySource = aggregate1
    ? migrateLegacyStrategyRecord(strategy.inputOrderPositions)
    : strategy.inputOrderPositions;
  if (strategySource === null) return null;
  const permutationSource = strategy.inputOrderPermutations ?? {};

  if (previousCoordination
    && !validateLegacyCoordinationRecord(value.motor.coordination, aggregate1)) return null;
  const coordinationSource = previousCoordination ? {} : value.motor.coordination;

  const inputOrderPositions = parseRecord(
    strategySource,
    parseInputOrderPosition,
    (aggregate) => inputOrderPositionAggregateKey(aggregate.scope),
    CURRENT_STRATEGY_KEY_LIMIT,
  );
  const inputOrderPermutations = parseRecord(
    permutationSource,
    parseInputOrderPermutation,
    (aggregate) => inputOrderPermutationAggregateKey(aggregate.scope),
    THREE_PART_PERMUTATION_KEY_LIMIT,
  );
  const coordination = parseRecord(
    coordinationSource,
    (candidate) => parseMotor(candidate, parseCoordinationScope),
    (aggregate) => coordinationAggregateKey(aggregate.scope),
    CURRENT_COORDINATION_KEY_LIMIT,
  );
  const immediateTokenSource = value.motor.immediateTokens ?? {};
  const immediateTokens = parseRecord(
    immediateTokenSource,
    (candidate) => parseMotor(
      candidate,
      (scope) => parseImmediateTokenScope(scope, validTokens),
    ),
    (aggregate) => immediateTokenAggregateKey(aggregate.scope),
    validTokens.size * validTokens.size,
  );
  const immediateHands = parseRecord(
    value.motor.immediateHands,
    (candidate) => parseMotor(candidate, parseImmediateHandScope),
    (aggregate) => immediateHandAggregateKey(aggregate.scope),
    4,
  );
  const sameHandRevisits = parseRecord(
    value.motor.sameHandRevisits,
    (candidate) => parseMotor(candidate, parseSameHandScope),
    (aggregate) => sameHandRevisitAggregateKey(aggregate.scope),
    4,
  );
  const toneCommits = parseRecord(
    value.motor.toneCommits,
    (candidate) => parseMotor(candidate, (scope) => parseToneScope(scope, validTokens)),
    (aggregate) => toneCommitAggregateKey(aggregate.scope),
  );
  if (bindings === null || confusions === null || inputOrderPositions === null
    || inputOrderPermutations === null || coordination === null || immediateTokens === null
    || immediateHands === null || sameHandRevisits === null || toneCommits === null) return null;

  return {
    policyVersion: MEASUREMENT_V2_POLICY_VERSION,
    semantic: {
      bindings,
      confusions,
      ambiguousErrors: value.semantic.ambiguousErrors as number,
      duplicateComponents: value.semantic.duplicateComponents as number,
      prematureTones: value.semantic.prematureTones as number,
    },
    strategy: { inputOrderPositions, inputOrderPermutations },
    motor: { coordination, immediateTokens, immediateHands, sameHandRevisits, toneCommits },
  };
}
