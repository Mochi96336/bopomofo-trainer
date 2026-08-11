import type { BindingSkillScope, PracticeMode, TokenId } from "../core/model.js";
import {
  coordinationTimingSample,
  immediateHandTimingSample,
  immediateTokenTimingSample,
  sameHandRevisitTimingSample,
  toneCommitTimingSample,
} from "./timing-eligibility.js";
import type {
  CoordinationBodyShape,
  ExplicitHand,
  MeasurementObservationsV2,
  ThreePartInputElapsedMs,
  ThreePartInputOrderPermutation,
  TwoPartInputElapsedMs,
  TwoPartInputOrderPermutation,
} from "./types.js";

export const LEGACY_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-1" as const;
export const HANDSHAPE_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-2" as const;
export const PREVIOUS_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-3" as const;
export const BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-4" as const;
export const MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-5" as const;
/** Maximum recent clean trajectory samples retained independently for each body size. */
export const STRATEGY_TRAJECTORY_LIMIT = 80;
const SMOOTHING_ALPHA = 0.25;

/**
 * Input-order strategy only exists for words with at least two body components.
 * Standard Bopomofo has at most initial + medial + final, so 2 and 3 are the
 * complete strategy domain. Coordination itself now keys by actual body shape.
 */
export type CoordinationBodySizeBucket = "2" | "3";
export type BodyPositionBucket = "first" | "middle" | "last";

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

export interface InputOrderPositionAggregateScope {
  readonly bodySize: CoordinationBodySizeBucket;
  readonly canonicalPosition: BodyPositionBucket;
  readonly acceptedPosition: BodyPositionBucket;
}

export interface InputOrderPositionAggregate {
  readonly scope: InputOrderPositionAggregateScope;
  readonly observations: number;
}

export interface InputOrderPermutationAggregateScope {
  readonly bodySize: "3";
  readonly permutation: ThreePartInputOrderPermutation;
}

export interface InputOrderPermutationAggregate {
  readonly scope: InputOrderPermutationAggregateScope;
  readonly observations: number;
}

/** Recent clean input path, with the first accepted component at t=0. */
export type InputOrderTrajectorySample =
  | {
      readonly bodySize: "2";
      readonly permutation: TwoPartInputOrderPermutation;
      readonly elapsedMs: TwoPartInputElapsedMs;
    }
  | {
      readonly bodySize: "3";
      readonly permutation: ThreePartInputOrderPermutation;
      readonly elapsedMs: ThreePartInputElapsedMs;
    };

export interface MotorTimingAggregate<Scope> {
  readonly scope: Scope;
  readonly observations: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
}

export interface CoordinationAggregateScope {
  readonly bodyShape: CoordinationBodyShape;
}

/** Exact pair of actually accepted tokens, never canonical adjacency. */
export interface ImmediateTokenAggregateScope {
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
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
  readonly strategy: {
    readonly inputOrderPositions: Readonly<Record<string, InputOrderPositionAggregate>>;
    /** Additive bounded joint-order channel; older persisted summaries may omit it. */
    readonly inputOrderPermutations?: Readonly<Record<string, InputOrderPermutationAggregate>>;
    /** Newest clean two- and three-part paths; older records may omit it. */
    readonly recentInputOrderTrajectories?: readonly InputOrderTrajectorySample[];
  };
  readonly motor: {
    readonly coordination: Readonly<Record<string, MotorTimingAggregate<CoordinationAggregateScope>>>;
    readonly immediateTokens: Readonly<Record<string, MotorTimingAggregate<ImmediateTokenAggregateScope>>>;
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

export function coordinationBodySizeBucket(bodySize: number): CoordinationBodySizeBucket {
  if (bodySize === 2) return "2";
  if (bodySize === 3) return "3";
  throw new RangeError(`Bopomofo body-size evidence requires exactly 2 or 3 components, got ${bodySize}`);
}

export function bodyPositionBucket(index: number, bodySize: number): BodyPositionBucket {
  if (index <= 0) return "first";
  if (index >= bodySize - 1) return "last";
  return "middle";
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

export function inputOrderPositionAggregateKey(scope: InputOrderPositionAggregateScope): string {
  return JSON.stringify([
    "input-order-position",
    scope.bodySize,
    scope.canonicalPosition,
    scope.acceptedPosition,
  ]);
}

export function inputOrderPermutationAggregateKey(
  scope: InputOrderPermutationAggregateScope,
): string {
  return JSON.stringify([
    "input-order-permutation",
    scope.bodySize,
    scope.permutation,
  ]);
}

export function coordinationAggregateKey(scope: CoordinationAggregateScope): string {
  return JSON.stringify(["coordination", scope.bodyShape]);
}

export function immediateTokenAggregateKey(scope: ImmediateTokenAggregateScope): string {
  return JSON.stringify(["immediate-token", scope.fromToken, scope.toToken]);
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
    strategy: {
      inputOrderPositions: {},
      inputOrderPermutations: {},
      recentInputOrderTrajectories: [],
    },
    motor: {
      coordination: {},
      immediateTokens: {},
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

  const inputOrderPositions = seedMap(prior.strategy.inputOrderPositions);
  for (const observation of observations.inputOrderPositions) {
    const scope: InputOrderPositionAggregateScope = {
      bodySize: coordinationBodySizeBucket(observation.bodySize),
      canonicalPosition: bodyPositionBucket(observation.canonicalBodyIndex, observation.bodySize),
      acceptedPosition: bodyPositionBucket(observation.acceptedBodyIndex, observation.bodySize),
    };
    const key = inputOrderPositionAggregateKey(scope);
    const previous = inputOrderPositions.get(key);
    inputOrderPositions.set(key, {
      scope,
      observations: (previous?.observations ?? 0) + 1,
    });
  }

  const inputOrderPermutations = seedMap(prior.strategy.inputOrderPermutations ?? {});
  for (const observation of observations.inputOrderPermutations ?? []) {
    const scope: InputOrderPermutationAggregateScope = {
      bodySize: "3",
      permutation: observation.permutation,
    };
    const key = inputOrderPermutationAggregateKey(scope);
    const previous = inputOrderPermutations.get(key);
    inputOrderPermutations.set(key, {
      scope,
      observations: (previous?.observations ?? 0) + 1,
    });
  }

  const trajectoryCandidates: readonly InputOrderTrajectorySample[] = [
    ...(prior.strategy.recentInputOrderTrajectories ?? []),
    ...(observations.inputOrderTrajectories ?? []).map((observation): InputOrderTrajectorySample => (
      observation.bodySize === 2
        ? {
            bodySize: "2",
            permutation: observation.permutation,
            elapsedMs: observation.elapsedMs,
          }
        : {
            bodySize: "3",
            permutation: observation.permutation,
            elapsedMs: observation.elapsedMs,
          }
    )),
  ];
  const recentInputOrderTrajectories: readonly InputOrderTrajectorySample[] = [
    ...trajectoryCandidates
      .filter((sample) => sample.bodySize === "2")
      .slice(-STRATEGY_TRAJECTORY_LIMIT),
    ...trajectoryCandidates
      .filter((sample) => sample.bodySize === "3")
      .slice(-STRATEGY_TRAJECTORY_LIMIT),
  ];

  const coordination = seedMap(prior.motor.coordination);
  for (const observation of observations.coordination) {
    const scope: CoordinationAggregateScope = { bodyShape: observation.bodyShape };
    const key = coordinationAggregateKey(scope);
    const previous = coordination.get(key);
    const timing = addTiming(timingStateOf(previous), coordinationTimingSample(observation));
    coordination.set(key, { scope, ...timing });
  }

  const immediateTokens = seedMap(prior.motor.immediateTokens);
  for (const observation of observations.immediateTokens) {
    const scope: ImmediateTokenAggregateScope = {
      fromToken: observation.fromToken,
      toToken: observation.toToken,
    };
    const key = immediateTokenAggregateKey(scope);
    const previous = immediateTokens.get(key);
    const timing = addTiming(timingStateOf(previous), immediateTokenTimingSample(observation));
    immediateTokens.set(key, { scope, ...timing });
  }

  const immediateHands = seedMap(prior.motor.immediateHands);
  for (const observation of observations.immediateHands) {
    const scope: ImmediateHandAggregateScope = {
      fromHand: observation.fromHand,
      toHand: observation.toHand,
    };
    const key = immediateHandAggregateKey(scope);
    const previous = immediateHands.get(key);
    const timing = addTiming(timingStateOf(previous), immediateHandTimingSample(observation));
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
    const timing = addTiming(timingStateOf(previous), sameHandRevisitTimingSample(observation));
    sameHandRevisits.set(key, { scope, ...timing });
  }

  const toneCommits = seedMap(prior.motor.toneCommits);
  for (const observation of observations.toneCommits) {
    const scope: ToneCommitAggregateScope = { toneToken: observation.toneToken };
    const key = toneCommitAggregateKey(scope);
    const previous = toneCommits.get(key);
    const timing = addTiming(timingStateOf(previous), toneCommitTimingSample(observation));
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
    strategy: {
      inputOrderPositions: sortedRecord(inputOrderPositions),
      inputOrderPermutations: sortedRecord(inputOrderPermutations),
      recentInputOrderTrajectories,
    },
    motor: {
      coordination: sortedRecord(coordination),
      immediateTokens: sortedRecord(immediateTokens),
      immediateHands: sortedRecord(immediateHands),
      sameHandRevisits: sortedRecord(sameHandRevisits),
      toneCommits: sortedRecord(toneCommits),
    },
  };
}