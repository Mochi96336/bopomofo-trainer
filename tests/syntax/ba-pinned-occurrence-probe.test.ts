import { expect, it } from "vitest";
import { loadPinnedBaOccurrenceEvidence } from "../../scripts/ba-occurrence-source.js";

it("prints the pinned BA occurrence audit for review", async () => {
  const evidence = await loadPinnedBaOccurrenceEvidence();
  const summary = {
    oblPatientPredicateTokenCount: evidence.oblPatientPredicateTokenCount,
    oblPatientLexemeUposCount: evidence.oblPatientPredicateCounts.size,
    baMarkedPatientPredicateTokenCount: evidence.baMarkedPatientPredicateTokenCount,
    baMarkedPatientLexemeUposCount: evidence.baMarkedPatientPredicateCounts.size,
    markerCounts: Object.fromEntries([...evidence.markerCounts].sort()),
  };
  console.log(`BA_PINNED_AUDIT=${JSON.stringify(summary)}`);
  expect(evidence.baMarkedPatientPredicateTokenCount).toBeGreaterThan(0);
  expect(evidence.baMarkedPatientPredicateTokenCount)
    .toBeLessThanOrEqual(evidence.oblPatientPredicateTokenCount);
});
