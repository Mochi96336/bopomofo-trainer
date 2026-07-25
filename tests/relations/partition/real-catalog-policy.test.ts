import { describe, expect, it } from "vitest";
import {
  evaluatePartitionMetrics,
  partitionBindingPreservingBaseline,
  partitionCommonnessStratified,
  partitionPathNovelty,
  partitionRelationSupportPreserving,
  partitionSeededMaximumCoverage,
  type PartitionDecision,
} from "../../../src/relations/partition/index.js";
import { compileRealCatalog, createPartitionInput } from "./helpers.js";

describe("relational partition policies (real catalog)", () => {
  it("reports the current catalog baseline's support diagnostics", async () => {
    const entries = await compileRealCatalog();
    const input = createPartitionInput(entries);
    const decision = partitionBindingPreservingBaseline(input);

    expect(decision.trainingEntryIds).toHaveLength(entries.length - 5);
    expect(decision.evaluationEntryIds).toHaveLength(5);
    expect(new Set([
      ...decision.trainingEntryIds,
      ...decision.evaluationEntryIds,
    ]).size).toBe(entries.length);
    expect(decision.metrics.bindingCoverage.evaluationOnlyRelationCount).toBe(0);
    expect(decision.metrics.transitionCoverage.evaluationOnlyRelationKeys)
      .toHaveLength(decision.metrics.transitionCoverage.evaluationOnlyRelationCount);
    const supportDiagnostic = decision.constraintResults.find(
      (constraint) => constraint.id === "relation-training-support",
    );
    expect(supportDiagnostic).toMatchObject({ kind: "diagnostic" });
    expect(typeof supportDiagnostic?.actual).toBe("number");
    expect(decision.selectionTrace.at(-1)).toMatchObject({
      action: "stopped",
      reasonCode: "evaluation-target-reached",
    });
  }, 120_000);

  // Five relational partition strategies over the full active catalog
  // (13,897 entries as of the top-160000 automated-only lexicon
  // generation); the default test timeout no longer covers this at this
  // scale.
  it("runs all five strategies on the current catalog", async () => {
    const entries = await compileRealCatalog();
    const input = createPartitionInput(entries);
    const options = {
      evaluationEntryCount: 5,
      minimumTrainingDistinctEntries: 1,
    } as const;
    const decisions: readonly PartitionDecision[] = [
      partitionBindingPreservingBaseline(input),
      partitionRelationSupportPreserving(input, options),
      partitionCommonnessStratified(input, {
        ...options,
        allowCrossTierFallback: true,
      }),
      partitionSeededMaximumCoverage(input, 20260720, options),
      partitionPathNovelty(input, options),
    ];

    expect(new Set(decisions.map((decision) => decision.policyId)).size).toBe(5);
    for (const decision of decisions) {
      expect(decision.trainingEntryIds).toHaveLength(entries.length - 5);
      expect(decision.evaluationEntryIds).toHaveLength(5);
      expect(decision.constraintResults.filter(
        (constraint) => constraint.kind === "hard" && constraint.status === "unsatisfied",
      )).toEqual([]);
      expect(evaluatePartitionMetrics(
        input,
        new Set(decision.evaluationEntryIds),
        decision.constraintResults,
      )).toEqual(decision.metrics);
    }
    for (const decision of decisions.slice(1)) {
      expect(decision.metrics.evaluationOnlyRelationCount).toBe(0);
    }
  }, 480_000);
});
