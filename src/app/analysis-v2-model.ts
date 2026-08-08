import type { TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  InputOrderPositionAggregate,
  MeasurementSummaryV2,
  MotorTimingAggregate,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";
import type {
  ConfusionDiagnostic,
  DiagnosticModel,
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
  readonly coordination: readonly AnalysisV2MotorCell<CoordinationAggregateScope>[];
  readonly immediateHands: readonly AnalysisV2MotorCell<ImmediateHandAggregateScope>[];
  readonly sameHandRevisits: readonly AnalysisV2MotorCell<SameHandRevisitAggregateScope>[];
  readonly toneCommits: readonly AnalysisV2MotorCell<ToneCommitAggregateScope>[];
  readonly observedScopes: number;
  readonly readyScopes: number;
  readonly cleanTimingSamples: number;
}

export interface AnalysisV2StrategyModel {
  readonly inputOrderPositions: readonly InputOrderPositionAggregate[];
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
      return {
        id,
        scope: aggregate.scope,
        observations: aggregate.observations,
        timingSamples: aggregate.timingSamples,
        currentTimeToTypeMs: aggregate.currentTimeToTypeMs,
        bestTimeToTypeMs: aggregate.bestTimeToTypeMs,
        ready: aggregate.timingSamples >= ANALYSIS_V2_MOTOR_READY_SAMPLES
          && aggregate.currentTimeToTypeMs !== null,
        history: history?.timing ?? [],
        partialTimingSamples: history?.partialTiming.samples.length ?? 0,
      };
    });
}

function countRepeatedConfusions(confusions: readonly ConfusionDiagnostic[]): number {
  return confusions.filter((row) => row.occurrences >= 2).length;
}

export function buildAnalysisV2Model(
  semantic: DiagnosticModel,
  measurements: MeasurementSummaryV2,
  history: ProgressHistory | null,
): AnalysisV2Model {
  const coordination = joinMotorFamily(
    measurements.motor.coordination,
    history?.motor.coordination,
  );
  const immediateHands = joinMotorFamily(
    measurements.motor.immediateHands,
    history?.motor.immediateHands,
  );
  const sameHandRevisits = joinMotorFamily(
    measurements.motor.sameHandRevisits,
    history?.motor.sameHandRevisits,
  );
  const toneCommits = joinMotorFamily(
    measurements.motor.toneCommits,
    history?.motor.toneCommits,
  );
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

  return {
    semantic: {
      keys: semantic.keys,
      confusions: semantic.confusions,
      keyProgress: semantic.keyProgress,
      keysWithData: semantic.keys.filter((row) => row.attempts > 0).length,
      repeatedConfusions: countRepeatedConfusions(semantic.confusions),
    },
    coordination: {
      coordination,
      immediateHands,
      sameHandRevisits,
      toneCommits,
      observedScopes: motor.filter((row) => row.observations > 0).length,
      readyScopes: motor.filter((row) => row.ready).length,
      cleanTimingSamples: motor.reduce((sum, row) => sum + row.timingSamples, 0),
    },
    strategy: {
      inputOrderPositions: positions,
      totalObservations: positions.reduce((sum, row) => sum + row.observations, 0),
      bodySizeBucketsWithData: new Set(positions.map((row) => row.scope.bodySize)).size,
    },
  };
}
