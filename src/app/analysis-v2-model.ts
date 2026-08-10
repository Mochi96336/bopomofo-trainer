import type { TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  ImmediateTokenAggregateScope,
  InputOrderPermutationAggregate,
  InputOrderPositionAggregate,
  InputOrderTrajectorySample,
  MeasurementSummaryV2,
  MotorTimingAggregate,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";
import type {
  ConfusionDiagnostic,
  KeyDiagnostic,
  KeyProgressTrends,
} from "../diagnostics/types.js";
import type {
  MotorTimingProgressHistory,
  ProgressHistory,
  TimingTrendPoint,
} from "../progress-history/types.js";

export const ANALYSIS_V2_MOTOR_READY_SAMPLES = 5;

export interface AnalysisV2MotorCell<Scope> {
  readonly id: string;
  readonly scope: Scope;
  readonly observations: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
  readonly ready: boolean;
  readonly history: readonly TimingTrendPoint[];
  readonly partialTimingSamples: number;
}

export interface AnalysisV2SemanticModel {
  readonly keys: readonly KeyDiagnostic[];
  readonly confusions: readonly ConfusionDiagnostic[];
  readonly keyProgress: Readonly<Record<TokenId, KeyProgressTrends>>;
  readonly keysWithData: number;
  readonly repeatedConfusions: number;
}

export interface AnalysisV2CoordinationModel {
  /** Exact observed accepted-token edges used by the keyboard speed map. */
  readonly immediateTokens: readonly AnalysisV2MotorCell<ImmediateTokenAggregateScope>[];
  readonly coordination: readonly AnalysisV2MotorCell<CoordinationAggregateScope>[];
  readonly immediateHands: readonly AnalysisV2MotorCell<ImmediateHandAggregateScope>[];
  readonly sameHandRevisits: readonly AnalysisV2MotorCell<SameHandRevisitAggregateScope>[];
  readonly toneCommits: readonly AnalysisV2MotorCell<ToneCommitAggregateScope>[];
  readonly observedTokenTransitions: number;
  readonly readyTokenTransitions: number;
  readonly observedScopes: number;
  readonly readyScopes: number;
  readonly cleanTimingSamples: number;
}

export interface AnalysisV2StrategyModel {
  readonly inputOrderPositions: readonly InputOrderPositionAggregate[];
  /** Complete three-part word orders. Optional only for transitional fixtures. */
  readonly inputOrderPermutations?: readonly InputOrderPermutationAggregate[];
  /** Bounded newest clean complete input paths. */
  readonly recentInputOrderTrajectories?: readonly InputOrderTrajectorySample[];
  readonly totalObservations: number;
  readonly bodySizeBucketsWithData: number;
}

export interface AnalysisV2Model {
  readonly semantic: AnalysisV2SemanticModel;
  readonly coordination: AnalysisV2CoordinationModel;
  readonly strategy: AnalysisV2StrategyModel;
}

function joinMotorFamily<Scope>(
  aggregates: Readonly<Record<string, MotorTimingAggregate<Scope>>>,
  histories: Readonly<Record<string, MotorTimingProgressHistory<Scope>>> | undefined,
): readonly AnalysisV2MotorCell<Scope>[] {
  return Object.entries(aggregates)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([id, aggregate]) => {
      const history = histories?.[id];
      const ready = aggregate.timingSamples >= ANALYSIS_V2_MOTOR_READY_SAMPLES
        && aggregate.currentTimeToTypeMs !== null;
      return {
        id,
        scope: aggregate.scope,
        observations: aggregate.observations,
        timingSamples: aggregate.timingSamples,
        // A preliminary timing is useful internally, but exposing it as a
        // sortable Analysis value would imply a comparison before the family
        // reaches its evidence threshold. Sampling rows therefore retain their
        // support counters while their comparable current value stays absent.
        currentTimeToTypeMs: ready ? aggregate.currentTimeToTypeMs : null,
        bestTimeToTypeMs: aggregate.bestTimeToTypeMs,
        ready,
        history: history?.timing ?? [],
        partialTimingSamples: history?.partialTiming.samples.length ?? 0,
      };
    });
}

export function buildAnalysisV2Model(
  semantic: AnalysisV2SemanticModel,
  measurements: MeasurementSummaryV2,
  history: ProgressHistory | null,
): AnalysisV2Model {
  const immediateTokens = joinMotorFamily(
    measurements.motor.immediateTokens,
    history?.motor.immediateTokens,
  );
  const coordination = joinMotorFamily(
    measurements.motor.coordination,
    history?.motor.coordination,
  );
  const immediateHands = joinMotorFamily(
    measurements.motor.immediateHands,
    history?.motor.immediateHands,
  );
  // Zero-opposite-hand revisits are exactly the same adjacent timing already
  // represented by immediateHands (L→L / R→R). Keep them in persistence for
  // measurement continuity, but omit them from the Analysis presentation model
  // so summary counts and visible rows describe only genuine leave-and-return
  // patterns (L→R→L / R→L→R).
  const sameHandRevisits = joinMotorFamily(
    measurements.motor.sameHandRevisits,
    history?.motor.sameHandRevisits,
  ).filter((cell) => cell.scope.oppositeHandIntervened);
  const toneCommits = joinMotorFamily(
    measurements.motor.toneCommits,
    history?.motor.toneCommits,
  );
  // Keep the summary count on the four low-dimensional comparable families.
  // Exact token pairs are reported separately so a growing sparse network does
  // not make "coordination scopes" look like a single giant metric family.
  const motor = [
    ...coordination,
    ...immediateHands,
    ...sameHandRevisits,
    ...toneCommits,
  ];
  const positions = Object.values(measurements.strategy.inputOrderPositions)
    .sort((left, right) => {
      const a = JSON.stringify(left.scope);
      const b = JSON.stringify(right.scope);
      return a < b ? -1 : a > b ? 1 : 0;
    });
  const permutations = Object.values(measurements.strategy.inputOrderPermutations ?? {})
    .sort((left, right) => left.scope.permutation.localeCompare(right.scope.permutation));

  return {
    semantic,
    coordination: {
      immediateTokens,
      coordination,
      immediateHands,
      sameHandRevisits,
      toneCommits,
      observedTokenTransitions: immediateTokens.filter((row) => row.observations > 0).length,
      readyTokenTransitions: immediateTokens.filter((row) => row.ready).length,
      observedScopes: motor.filter((row) => row.observations > 0).length,
      readyScopes: motor.filter((row) => row.ready).length,
      cleanTimingSamples: motor.reduce((sum, row) => sum + row.timingSamples, 0),
    },
    strategy: {
      inputOrderPositions: positions,
      inputOrderPermutations: permutations,
      recentInputOrderTrajectories: measurements.strategy.recentInputOrderTrajectories ?? [],
      totalObservations: positions.reduce((sum, row) => sum + row.observations, 0),
      bodySizeBucketsWithData: new Set(positions.map((row) => row.scope.bodySize)).size,
    },
  };
}
