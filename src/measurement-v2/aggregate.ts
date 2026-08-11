import type { BindingSkillScope, PracticeMode, TokenId } from "../core/model.js";
import type {
  CoordinationHandShape,
  ExplicitHand,
  MeasurementObservationsV2,
} from "./types.js";

export const MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-1" as const;
const SMOOTHING_ALPHA = 0.25;

export type CoordinationBodySizeBucket = "2" | "3" | "4+";

export interface BindingAggregateV2 {
  readonly scope: BindingSkillScope;
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
}

export interface ConfusionAggregateV2 {
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly expectedToken: TokenId;
  readonly actualToken: TokenId;
  readonly occurrences: number;
}

export interface MotorTimingAggregate<Scope> {
  readonly scope: Scope;
  readonly observations: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
}

export interface CoordinationAggregateScope {
  readonly bodySize: CoordinationBodySizeBucket;
  readonly handShape: CoordinationHandShape;
}

export interface ImmediateHandAggregateScope {
  readonly fromHand: ExplicitHand;
  readonly toHand: ExplicitHand;
}

export interface SameHandRevisitAggregateScope {
  readonly hand: ExplicitHand;
  readonly oppositeHandIntervened: boolean;
}

export interface ToneCommitAggregateScope {
  readonly toneToken: TokenId;
}

export interface MeasurementSummaryV2 {
  readonly policyVersion: typeof MEASUREMENT_V2_POLICY_VERSION;
  readonly semantic: {
    readonly bindings: Readonly<Record<string, BindingAggregateV2>>;
    readonly confusions: Readonly<Record<string, ConfusionAggregateV2>>;
    readonly ambiguousErrors: number;
    readonly duplicateComponents: number;
    readonly prematureTones: number;
  };
  readonly motor: {
    readonly coordination: Readonly<Record<string, MotorTimingAggregate<CoordinationAggregateScope>>>;
    readonly immediateHands: Readonly<Record<string, MotorTimingAggregate<ImmediateHandAggregateScope>>>;
    readonly sameHandRevisits: Readonly<Record<string, MotorTimingAggregate<SameHandRevisitAggregateScope>>>;
    readonly toneCommits: Readonly<Record<string, MotorTimingAggregate<ToneCommitAggregateScope>>>;
  };
}

interface TimingState {
  readonly observations: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function addTiming(
  state: TimingState,
  sample: number | null,
): TimingState {
  if (sample === null) {
    return { ...state, observations: state.observations + 1 };
  }
  const current = state.currentTimeToTypeMs === null
    ? sample
    : state.currentTimeToTypeMs + SMOOTHING_ALPHA * (sample - state.currentTimeToTypeMs);
  return {
    observations: state.observations + 1,
    timingSamples: state.timingSamples + 1,
    currentTimeToTypeMs: round(current),
    bestTimeToTypeMs: state.bestTimeToTypeMs === null
      ? round(sample)
      : round(Math.min(state.bestTimeToTypeMs, sample)),
  };
}

function emptyTimingState(): TimingState {
  return {
    observations: 0,
    timingSamples: 0,
    currentTimeToTypeMs: null,
    bestTimeToTypeMs: null,
  };
}

function coordinationBodySizeBucket(bodySize: number): CoordinationBodySizeBucket {
  if (bodySize <= 2) return "2";
  if (bodySize === 3) return "3";
  return "4+";
}

export function bindingAggregateKey(scope: BindingSkillScope): string {
  return JSON.stringify(["binding", scope.mode, scope.layoutId, scope.tokenId]);
}

export function confusionAggregateKey(
  mode: PracticeMode,
  layoutId: string,
  expectedToken: TokenId,
  actualToken: TokenId,
): string {
  return JSON.stringify(["confusion", mode, layoutId, expectedToken, actualToken]);
}

export function coordinationAggregateKey(scope: CoordinationAggregateScope): string {
  return JSON.stringify(["coordination", scope.bodySize, scope.handShape]);
}

export function immediateHandAggregateKey(scope: ImmediateHandAggregateScope): string {
  return JSON.stringify(["immediate-hand", scope.fromHand, scope.toHand]);
}

export function sameHandRevisitAggregateKey(scope: SameHandRevisitAggregateScope): string {
  return JSON.stringify(["same-hand-revisit", scope.hand, scope.oppositeHandIntervened]);
}

export function toneCommitAggregateKey(scope: ToneCommitAggregateScope): string {
  return JSON.stringify(["tone-commit", scope.toneToken]);
}

export function createEmptyMeasurementSummaryV2(): MeasurementSummaryV2 {
  return {
    policyVersion: MEASUREMENT_V2_POLICY_VERSION,
    semantic: {
      bindings: {},
      confusions: {},
      ambiguousErrors: 0,
      duplicateComponents: 0,
      prematureTones: 0,
    },
    motor: {
      coordination: {},
      immediateHands: {},
      sameHandRevisits: {},
      toneCommits: {},
    },
  };
}

function sortedRecord<T>(source: ReadonlyMap<string, T>): Readonly<Record<string, T>> {
  return Object.fromEntries(
    [...source.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  );
}

function seedMap<T>(record: Readonly<Record<string, T>>): Map<string, T> {
  return new Map(Object.entries(record));
}

function timingStateOf<Scope>(
  aggregate: MotorTimingAggregate<Scope> | undefined,
): TimingState {
  if (aggregate === undefined) return emptyTimingState();
  return {
    observations: aggregate.observations,
    timingSamples: aggregate.timingSamples,
    currentTimeToTypeMs: aggregate.currentTimeToTypeMs,
    bestTimeToTypeMs: aggregate.bestTimeToTypeMs,
  };
}

export function aggregateMeasurementObservationsV2(
  observations: MeasurementObservationsV2,
  prior: MeasurementSummaryV2 = createEmptyMeasurementSummaryV2(),
): MeasurementSummaryV2 {
  if (prior.policyVersion !== MEASUREMENT_V2_POLICY_VERSION) {
    throw new Error(`measurement v2 policy mismatch: ${prior.policyVersion}`);
  }

  const bindings = seedMap(prior.semantic.bindings);
  for (const observation of observations.bindings) {
    const key = bindingAggregateKey(observation.scope);
    const previous = bindings.get(key);
    const timingSamples = previous?.timingSamples ?? 0;
    const current = previous?.currentTimeToTypeMs ?? null;
    const best = previous?.bestTimeToTypeMs ?? null;
    const sample = observation.timingMs;
    const nextCurrent = sample === null
      ? current
      : current === null
        ? sample
        : current + SMOOTHING_ALPHA * (sample - current);
    bindings.set(key, {
      scope: observation.scope,
      attempts: (previous?.attempts ?? 0) + 1,
      errors: (previous?.errors ?? 0) + (observation.correct ? 0 : 1),
      timingSamples: timingSamples + (sample === null ? 0 : 1),
      currentTimeToTypeMs: nextCurrent === null ? null : round(nextCurrent),
      bestTimeToTypeMs: sample === null
        ? best
        : best === null
          ? round(sample)
          : round(Math.min(best, sample)),
    });
  }

  const confusions = seedMap(prior.semantic.confusions);
  for (const observation of observations.confusions) {
    const key = confusionAggregateKey(
      observation.mode,
      observation.layoutId,
      observation.expectedToken,
      observation.actualToken,
    );
    const previous = confusions.get(key);
    confusions.set(key, {
      mode: observation.mode,
      layoutId: observation.layoutId,
      expectedToken: observation.expectedToken,
      actualToken: observation.actualToken,
      occurrences: (previous?.occurrences ?? 0) + 1,
    });
  }

  const coordination = seedMap(prior.motor.coordination);
  for (const observation of observations.coordination) {
    const scope: CoordinationAggregateScope = {
      bodySize: coordinationBodySizeBucket(observation.bodySize),
      handShape: observation.handShape,
    };
    const key = coordinationAggregateKey(scope);
    const previous = coordination.get(key);
    const timing = addTiming(timingStateOf(previous), observation.clean ? observation.timingMs : null);
    coordination.set(key, { scope, ...timing });
  }

  const immediateHands = seedMap(prior.motor.immediateHands);
  for (const observation of observations.immediateHands) {
    const scope: ImmediateHandAggregateScope = {
      fromHand: observation.fromHand,
      toHand: observation.toHand,
    };
    const key = immediateHandAggregateKey(scope);
    const previous = immediateHands.get(key);
    // Crossing a syllable/entry boundary includes reading and target-location
    // latency, not just hand coordination. Keep the event as an observation for
    // coverage/debugging, but only within-syllable hand paths may shape the
    // motor timing estimate.
    const eligible = observation.clean && observation.boundary === "within-syllable";
    const timing = addTiming(timingStateOf(previous), eligible ? observation.timingMs : null);
    immediateHands.set(key, { scope, ...timing });
  }

  const sameHandRevisits = seedMap(prior.motor.sameHandRevisits);
  for (const observation of observations.sameHandRevisits) {
    const scope: SameHandRevisitAggregateScope = {
      hand: observation.hand,
      oppositeHandIntervened: observation.oppositeHandEventsBetween > 0,
    };
    const key = sameHandRevisitAggregateKey(scope);
    const previous = sameHandRevisits.get(key);
    const eligible = observation.clean && observation.boundary === "within-syllable";
    const timing = addTiming(timingStateOf(previous), eligible ? observation.timingMs : null);
    sameHandRevisits.set(key, { scope, ...timing });
  }

  const toneCommits = seedMap(prior.motor.toneCommits);
  for (const observation of observations.toneCommits) {
    const scope: ToneCommitAggregateScope = { toneToken: observation.toneToken };
    const key = toneCommitAggregateKey(scope);
    const previous = toneCommits.get(key);
    const timing = addTiming(timingStateOf(previous), observation.clean ? observation.timingMs : null);
    toneCommits.set(key, { scope, ...timing });
  }

  return {
    policyVersion: MEASUREMENT_V2_POLICY_VERSION,
    semantic: {
      bindings: sortedRecord(bindings),
      confusions: sortedRecord(confusions),
      ambiguousErrors: prior.semantic.ambiguousErrors + observations.ambiguousErrorCount,
      duplicateComponents: prior.semantic.duplicateComponents + observations.duplicateComponentCount,
      prematureTones: prior.semantic.prematureTones + observations.prematureToneCount,
    },
    motor: {
      coordination: sortedRecord(coordination),
      immediateHands: sortedRecord(immediateHands),
      sameHandRevisits: sortedRecord(sameHandRevisits),
      toneCommits: sortedRecord(toneCommits),
    },
  };
}
