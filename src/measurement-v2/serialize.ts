import type { PracticeMode } from "../core/model.js";
import {
  MEASUREMENT_V2_POLICY_VERSION,
  bindingAggregateKey,
  confusionAggregateKey,
  coordinationAggregateKey,
  immediateHandAggregateKey,
  inputOrderPositionAggregateKey,
  sameHandRevisitAggregateKey,
  toneCommitAggregateKey,
  type BindingAggregateV2,
  type BodyPositionBucket,
  type ConfusionAggregateV2,
  type CoordinationAggregateScope,
  type CoordinationBodySizeBucket,
  type ImmediateHandAggregateScope,
  type InputOrderPositionAggregate,
  type InputOrderPositionAggregateScope,
  type MeasurementSummaryV2,
  type MotorTimingAggregate,
  type SameHandRevisitAggregateScope,
  type ToneCommitAggregateScope,
} from "./aggregate.js";
import type { CoordinationHandShape, ExplicitHand } from "./types.js";

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

function bodySizeBucket(value: unknown): value is CoordinationBodySizeBucket {
  return value === "2" || value === "3" || value === "4+";
}

function bodyPosition(value: unknown): value is BodyPositionBucket {
  return value === "first" || value === "middle" || value === "last";
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
  if (!isRecord(value) || !bodySizeBucket(value.bodySize) || !handShape(value.handShape)) return null;
  return { bodySize: value.bodySize, handShape: value.handShape };
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

export function parseMeasurementSummaryV2(
  value: unknown,
  mode: PracticeMode,
  layoutId: string,
  validTokens: ReadonlySet<string>,
): MeasurementSummaryV2 | null {
  if (!isRecord(value)
    || value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION
    || !isRecord(value.semantic)
    || !isRecord(value.motor)
    || !isNonNegativeInteger(value.semantic.ambiguousErrors)
    || !isNonNegativeInteger(value.semantic.duplicateComponents)
    || !isNonNegativeInteger(value.semantic.prematureTones)) return null;

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

  // Strategy evidence was added after the V2 measurement epoch shipped. A
  // current-schema record without this section is safely interpreted as having
  // no strategy history yet; no existing semantic or motor evidence changes.
  const strategy = value.strategy === undefined
    ? { inputOrderPositions: {} }
    : value.strategy;
  if (!isRecord(strategy)) return null;
  const inputOrderPositions = parseRecord(
    strategy.inputOrderPositions,
    parseInputOrderPosition,
    (aggregate) => inputOrderPositionAggregateKey(aggregate.scope),
    27,
  );

  const coordination = parseRecord(
    value.motor.coordination,
    (candidate) => parseMotor(candidate, parseCoordinationScope),
    (aggregate) => coordinationAggregateKey(aggregate.scope),
    12,
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
    || coordination === null || immediateHands === null
    || sameHandRevisits === null || toneCommits === null) return null;

  return {
    policyVersion: MEASUREMENT_V2_POLICY_VERSION,
    semantic: {
      bindings,
      confusions,
      ambiguousErrors: value.semantic.ambiguousErrors as number,
      duplicateComponents: value.semantic.duplicateComponents as number,
      prematureTones: value.semantic.prematureTones as number,
    },
    strategy: { inputOrderPositions },
    motor: { coordination, immediateHands, sameHandRevisits, toneCommits },
  };
}
