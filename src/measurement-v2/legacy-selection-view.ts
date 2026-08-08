import type { MeasurementSummary } from "../measurement/types.js";
import type { MeasurementSummaryV2 } from "./aggregate.js";

/**
 * Compatibility view for selection code that has not yet been rewritten around
 * the v2 summary shape.
 *
 * Only binding evidence is semantically portable. Canonical token adjacency is
 * not an observed motor transition, so `transitions` is deliberately empty.
 * Confusions are projected because v2 only emits them when the expected token is
 * unambiguous.
 */
export function legacySelectionMeasurementView(
  summary: MeasurementSummaryV2,
  policyVersion = "input-order-v2-selection-view",
): MeasurementSummary {
  const bindings = Object.fromEntries(Object.entries(summary.semantic.bindings).map(([key, aggregate]) => [
    key,
    {
      ...aggregate,
      timingExclusions: {
        syllableStart: 0,
        incorrect: aggregate.errors,
        recovery: 0,
        interactionNoise: 0,
      },
    },
  ]));
  const confusions = Object.fromEntries(Object.entries(summary.semantic.confusions).map(([key, aggregate]) => [
    key,
    {
      scope: {
        mode: aggregate.mode,
        layoutId: aggregate.layoutId,
        expectedToken: aggregate.expectedToken,
        actualToken: aggregate.actualToken,
      },
      occurrences: aggregate.occurrences,
    },
  ]));
  const bindingObservationCount = Object.values(summary.semantic.bindings)
    .reduce((total, aggregate) => total + aggregate.attempts, 0);
  const confusionObservationCount = Object.values(summary.semantic.confusions)
    .reduce((total, aggregate) => total + aggregate.occurrences, 0);

  return {
    policyVersion,
    traceCount: bindingObservationCount,
    bindingObservationCount,
    confusionObservationCount,
    transitionObservationCount: 0,
    bindings,
    confusions,
    transitions: {},
  };
}
