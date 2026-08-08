import type { InputLayout, TokenId } from "../core/model.js";
import type { FrequencyFirstUtterancePolicy } from "../curriculum/frequency-first-utterance.js";
import type {
  CatalogSupportIndex,
  CurriculumProfile,
} from "../curriculum/types.js";
import {
  bindingAggregateKey,
  type BindingAggregateV2,
  type MeasurementSummaryV2,
} from "../measurement-v2/aggregate.js";
import { PROGRESS_HISTORY_POLICY } from "../progress-history/policy.js";
import type { ProgressHistory } from "../progress-history/types.js";
import {
  physicalKeyLabel,
  tokenLabel,
} from "../diagnostics/labels.js";
import {
  dataStateForSamples,
  DIAGNOSTIC_POLICY,
} from "../diagnostics/policy.js";
import { buildProgressTrendIndex } from "../diagnostics/progress-trends.js";
import type {
  ConfusionDiagnostic,
  KeyDiagnostic,
  KeyProgressTrends,
} from "../diagnostics/types.js";
import type { AnalysisV2SemanticModel } from "./analysis-v2-model.js";

export interface BuildAnalysisV2SemanticModelInput {
  readonly measurements: MeasurementSummaryV2;
  readonly curriculum: CurriculumProfile;
  readonly support: CatalogSupportIndex;
  readonly layout: InputLayout;
  readonly selectionPolicy: FrequencyFirstUtterancePolicy;
  readonly progressHistory?: ProgressHistory | null;
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function reverseLayout(layout: InputLayout): ReadonlyMap<TokenId, string> {
  const result = new Map<TokenId, string>();
  for (const [code, tokenId] of Object.entries(layout.bindings)) {
    if (!result.has(tokenId)) result.set(tokenId, code);
  }
  return result;
}

function bindingFor(
  input: BuildAnalysisV2SemanticModelInput,
  tokenId: TokenId,
): BindingAggregateV2 | undefined {
  return input.measurements.semantic.bindings[bindingAggregateKey({
    mode: input.curriculum.mode,
    layoutId: input.curriculum.layoutId,
    tokenId,
  })];
}

function buildKeys(
  input: BuildAnalysisV2SemanticModelInput,
  codeByToken: ReadonlyMap<TokenId, string>,
): readonly KeyDiagnostic[] {
  const tokenIds = [...codeByToken.keys()]
    .filter((tokenId) => input.support.byToken[tokenId] !== undefined)
    .sort(codeUnitCompare);

  return tokenIds.map((tokenId) => {
    const physicalCode = codeByToken.get(tokenId) ?? "";
    const aggregate = bindingFor(input, tokenId);
    const attempts = aggregate?.attempts ?? 0;
    const errors = aggregate?.errors ?? 0;
    const timingSamples = aggregate?.timingSamples ?? 0;
    const errorDataState = dataStateForSamples(attempts, DIAGNOSTIC_POLICY.errorSamples);
    const timingAvailable = (input.support.byToken[tokenId]?.motorEntryCount ?? 0) > 0;
    const timingAvailability = timingAvailable ? "available" : "not-applicable";
    const timingDataState = timingAvailable
      ? dataStateForSamples(timingSamples, DIAGNOSTIC_POLICY.timingSamples)
      : null;

    return {
      tokenId,
      symbol: tokenLabel(tokenId),
      physicalCode,
      physicalKey: physicalKeyLabel(physicalCode),
      attempts,
      errors,
      displayedErrorRatio: attempts === 0 ? null : errors / attempts,
      errorDataState,
      timingAvailability,
      timingMs: aggregate?.currentTimeToTypeMs ?? null,
      timingSamples,
      timingDataState,
    };
  });
}

function buildConfusions(
  input: BuildAnalysisV2SemanticModelInput,
  codeByToken: ReadonlyMap<TokenId, string>,
): readonly ConfusionDiagnostic[] {
  const aggregates = Object.values(input.measurements.semantic.confusions)
    .filter((aggregate) => aggregate.mode === input.curriculum.mode
      && aggregate.layoutId === input.curriculum.layoutId);
  const totals = new Map<TokenId, number>();
  for (const aggregate of aggregates) {
    totals.set(
      aggregate.expectedToken,
      (totals.get(aggregate.expectedToken) ?? 0) + aggregate.occurrences,
    );
  }

  return aggregates.map((aggregate) => {
    const expectedTotal = totals.get(aggregate.expectedToken) ?? 0;
    const expectedCode = codeByToken.get(aggregate.expectedToken) ?? "";
    const actualCode = codeByToken.get(aggregate.actualToken) ?? "";
    return {
      id: `confusion:${aggregate.expectedToken}->${aggregate.actualToken}`,
      expectedTokenId: aggregate.expectedToken,
      actualTokenId: aggregate.actualToken,
      expectedSymbol: tokenLabel(aggregate.expectedToken),
      actualSymbol: tokenLabel(aggregate.actualToken),
      expectedPhysicalKey: physicalKeyLabel(expectedCode),
      actualPhysicalKey: physicalKeyLabel(actualCode),
      occurrences: aggregate.occurrences,
      expectedConfusionTotal: expectedTotal,
      expectedErrorShare: expectedTotal === 0 ? 0 : aggregate.occurrences / expectedTotal,
      dataState: dataStateForSamples(
        aggregate.occurrences,
        DIAGNOSTIC_POLICY.relationshipSamples,
      ),
    };
  }).sort((left, right) => codeUnitCompare(left.id, right.id));
}

function keyProgress(
  keys: readonly KeyDiagnostic[],
  history: ProgressHistory | null,
): Readonly<Record<TokenId, KeyProgressTrends>> {
  return buildProgressTrendIndex(
    keys.map((key) => ({
      tokenId: key.tokenId,
      timingAvailable: key.timingAvailability === "available",
    })),
    history,
    {
      correctnessBucketSize: PROGRESS_HISTORY_POLICY.correctnessBucketSize,
      timingBucketSize: PROGRESS_HISTORY_POLICY.timingBucketSize,
    },
  );
}

/**
 * Native Analysis V2 semantic projection.
 *
 * This consumes Measurement V2 directly. It never converts the summary to the
 * legacy measurement shape and therefore cannot accidentally revive canonical
 * transition rows while building semantic UI evidence.
 *
 * `selectionPolicy` remains part of the input contract because the surrounding
 * Analysis composition receives the live product environment. The semantic
 * view itself does not project curriculum reinforcement: only evidence that is
 * actually rendered belongs in this model.
 */
export function buildAnalysisV2SemanticModel(
  input: BuildAnalysisV2SemanticModelInput,
): AnalysisV2SemanticModel {
  void input.selectionPolicy;
  const codeByToken = reverseLayout(input.layout);
  const keys = buildKeys(input, codeByToken);
  const confusions = buildConfusions(input, codeByToken);
  return {
    keys,
    confusions,
    keyProgress: keyProgress(keys, input.progressHistory ?? null),
    keysWithData: keys.filter((row) => row.attempts > 0).length,
    repeatedConfusions: confusions.filter((row) => row.occurrences >= 2).length,
  };
}
