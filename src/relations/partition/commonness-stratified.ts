import { catalogCommonnessTiers, COMMONNESS_TIERS, type CommonnessTier } from "../../commonness/tiers.js";
import { createPartitionDecision, numericConstraint } from "./decision.js";
import {
  createPartitionRelationModel,
  relationSupportViolations,
  validatePartitionInput,
} from "./model.js";
import type {
  CommonnessStratifiedOptions,
  PartitionDecision,
  PartitionFallbackReason,
  PartitionInput,
  PartitionSelectionTrace,
} from "./types.js";
import {
  compareText,
  sortedUnique,
  validatePositiveInteger,
} from "./utils.js";

export const DEFAULT_COMMONNESS_STRATIFIED_OPTIONS: CommonnessStratifiedOptions = {
  evaluationEntryCount: 5,
  minimumTrainingDistinctEntries: 1,
  allowCrossTierFallback: true,
};

function largestRemainderQuotas(
  counts: Readonly<Record<CommonnessTier, number>>,
  totalEntries: number,
  evaluationEntryCount: number,
): Readonly<Record<CommonnessTier, number>> {
  const raw = COMMONNESS_TIERS.map((tier) => ({
    tier,
    exact: counts[tier] / totalEntries * evaluationEntryCount,
  }));
  const quotas: Record<CommonnessTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of raw) quotas[item.tier] = Math.floor(item.exact);
  let remaining = evaluationEntryCount - COMMONNESS_TIERS.reduce(
    (total, tier) => total + quotas[tier],
    0,
  );
  const remainderOrder = [...raw].sort((left, right) =>
    (right.exact - Math.floor(right.exact))
      - (left.exact - Math.floor(left.exact))
    || left.tier - right.tier,
  );
  for (const item of remainderOrder) {
    if (remaining <= 0) break;
    quotas[item.tier] += 1;
    remaining -= 1;
  }
  return quotas;
}

export function partitionCommonnessStratified(
  input: PartitionInput,
  options: CommonnessStratifiedOptions = DEFAULT_COMMONNESS_STRATIFIED_OPTIONS,
): PartitionDecision {
  validatePositiveInteger(options.evaluationEntryCount, "evaluationEntryCount");
  validatePositiveInteger(
    options.minimumTrainingDistinctEntries,
    "minimumTrainingDistinctEntries",
  );
  const entries = validatePartitionInput(input);
  if (entries.length <= options.evaluationEntryCount) {
    throw new RangeError("catalog must contain more entries than the evaluation target");
  }
  const tiers = catalogCommonnessTiers(entries);
  const tierCounts: Record<CommonnessTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const entry of entries) tierCounts[tiers.get(entry.id)!] += 1;
  const quotas = largestRemainderQuotas(
    tierCounts,
    entries.length,
    options.evaluationEntryCount,
  );
  const model = createPartitionRelationModel(input.report.index);
  const evaluationEntryIds = new Set<string>();
  const trace: PartitionSelectionTrace[] = [];
  const fallbackReasons: PartitionFallbackReason[] = [];
  let step = 0;

  const selectedInTier = (tier: CommonnessTier): number => entries.filter(
    (entry) => tiers.get(entry.id) === tier && evaluationEntryIds.has(entry.id),
  ).length;

  for (const tier of COMMONNESS_TIERS) {
    while (selectedInTier(tier) < quotas[tier]) {
      const candidates = entries
        .filter((entry) =>
          tiers.get(entry.id) === tier && !evaluationEntryIds.has(entry.id),
        )
        .sort((left, right) => compareText(left.id, right.id));
      let selected = false;
      const blockedKeys = new Set<string>();
      for (const entry of candidates) {
        const proposed = new Set(evaluationEntryIds);
        proposed.add(entry.id);
        const violations = relationSupportViolations(
          model,
          proposed,
          options.minimumTrainingDistinctEntries,
          model.entryRelationKeys[entry.id] ?? [],
        );
        if (violations.length > 0) {
          const keys = violations.map((violation) => violation.relationKey);
          for (const key of keys) blockedKeys.add(key);
          trace.push({
            step,
            candidateEntryId: entry.id,
            action: "rejected",
            reasonCode: "commonness-quota-relation-support-violation",
            evaluationCountBefore: evaluationEntryIds.size,
            evaluationCountAfter: evaluationEntryIds.size,
            scoreComponents: {
              commonnessTier: tier,
              tierQuota: quotas[tier],
              selectedInTier: selectedInTier(tier),
              violatedRelationCount: violations.length,
            },
            violatedConstraintIds: ["relation-training-support"],
            relatedRelationKeys: sortedUnique(keys),
            seedTieBreak: null,
          });
          step += 1;
          continue;
        }
        evaluationEntryIds.add(entry.id);
        trace.push({
          step,
          candidateEntryId: entry.id,
          action: "selected",
          reasonCode: "commonness-tier-quota-selection",
          evaluationCountBefore: evaluationEntryIds.size - 1,
          evaluationCountAfter: evaluationEntryIds.size,
          scoreComponents: {
            commonnessTier: tier,
            tierQuota: quotas[tier],
            selectedInTier: selectedInTier(tier),
            stableEntryId: entry.id,
          },
          violatedConstraintIds: [],
          relatedRelationKeys: [],
          seedTieBreak: null,
        });
        step += 1;
        selected = true;
        break;
      }
      if (selected) continue;
      const constraintId = `commonness-tier-${tier}-quota`;
      fallbackReasons.push({
        code: "commonness-tier-quota-unmet",
        constraintId,
        message:
          `commonness tier ${tier} supplied ${selectedInTier(tier)}/${quotas[tier]} legal evaluation entries`,
        relatedEntryIds: [],
        relatedRelationKeys: sortedUnique(blockedKeys),
      });
      trace.push({
        step,
        candidateEntryId: null,
        action: "fallback",
        reasonCode: "commonness-tier-quota-unmet",
        evaluationCountBefore: evaluationEntryIds.size,
        evaluationCountAfter: evaluationEntryIds.size,
        scoreComponents: {
          commonnessTier: tier,
          tierQuota: quotas[tier],
          selectedInTier: selectedInTier(tier),
        },
        violatedConstraintIds: [constraintId],
        relatedRelationKeys: sortedUnique(blockedKeys),
        seedTieBreak: null,
      });
      step += 1;
      break;
    }
  }

  if (options.allowCrossTierFallback) {
    while (evaluationEntryIds.size < options.evaluationEntryCount) {
      const candidates = entries
        .filter((entry) => !evaluationEntryIds.has(entry.id))
        .sort((left, right) =>
          tiers.get(left.id)! - tiers.get(right.id)! || compareText(left.id, right.id),
        );
      let selected = false;
      const blockedKeys = new Set<string>();
      for (const entry of candidates) {
        const proposed = new Set(evaluationEntryIds);
        proposed.add(entry.id);
        const violations = relationSupportViolations(
          model,
          proposed,
          options.minimumTrainingDistinctEntries,
          model.entryRelationKeys[entry.id] ?? [],
        );
        if (violations.length > 0) {
          const keys = violations.map((violation) => violation.relationKey);
          for (const key of keys) blockedKeys.add(key);
          trace.push({
            step,
            candidateEntryId: entry.id,
            action: "rejected",
            reasonCode: "cross-tier-fallback-relation-support-violation",
            evaluationCountBefore: evaluationEntryIds.size,
            evaluationCountAfter: evaluationEntryIds.size,
            scoreComponents: {
              commonnessTier: tiers.get(entry.id)!,
              violatedRelationCount: violations.length,
            },
            violatedConstraintIds: ["relation-training-support"],
            relatedRelationKeys: sortedUnique(keys),
            seedTieBreak: null,
          });
          step += 1;
          continue;
        }
        evaluationEntryIds.add(entry.id);
        trace.push({
          step,
          candidateEntryId: entry.id,
          action: "fallback",
          reasonCode: "cross-tier-quota-fallback-selected",
          evaluationCountBefore: evaluationEntryIds.size - 1,
          evaluationCountAfter: evaluationEntryIds.size,
          scoreComponents: {
            commonnessTier: tiers.get(entry.id)!,
            selectedInTier: selectedInTier(tiers.get(entry.id)!),
            tierQuota: quotas[tiers.get(entry.id)!],
            stableEntryId: entry.id,
          },
          violatedConstraintIds: [],
          relatedRelationKeys: [],
          seedTieBreak: null,
        });
        step += 1;
        selected = true;
        break;
      }
      if (selected) continue;
      trace.push({
        step,
        candidateEntryId: null,
        action: "stopped",
        reasonCode: "no-legal-cross-tier-fallback-candidate",
        evaluationCountBefore: evaluationEntryIds.size,
        evaluationCountAfter: evaluationEntryIds.size,
        scoreComponents: {
          remainingTarget: options.evaluationEntryCount - evaluationEntryIds.size,
        },
        violatedConstraintIds: ["evaluation-entry-count"],
        relatedRelationKeys: sortedUnique(blockedKeys),
        seedTieBreak: null,
      });
      step += 1;
      break;
    }
  }

  if (trace.at(-1)?.action !== "stopped") {
    trace.push({
      step,
      candidateEntryId: null,
      action: "stopped",
      reasonCode: evaluationEntryIds.size === options.evaluationEntryCount
        ? "evaluation-target-reached"
        : "commonness-quota-selection-complete",
      evaluationCountBefore: evaluationEntryIds.size,
      evaluationCountAfter: evaluationEntryIds.size,
      scoreComponents: {
        evaluationTarget: options.evaluationEntryCount,
      },
      violatedConstraintIds: evaluationEntryIds.size === options.evaluationEntryCount
        ? []
        : ["evaluation-entry-count"],
      relatedRelationKeys: [],
      seedTieBreak: null,
    });
  }

  return createPartitionDecision(input, {
    policyId: "commonness-stratified-v1",
    seed: null,
    evaluationEntryIds,
    evaluationEntryCount: options.evaluationEntryCount,
    minimumTrainingDistinctEntries: options.minimumTrainingDistinctEntries,
    relationSupportConstraintKind: "hard",
    selectionTrace: trace,
    fallbackReasons,
    additionalConstraintResults: COMMONNESS_TIERS.map((tier) => numericConstraint(
      `commonness-tier-${tier}-quota`,
      "soft",
      selectedInTier(tier),
      "equal",
      quotas[tier],
      selectedInTier(tier) === quotas[tier]
        ? "commonness-tier-quota-satisfied"
        : "commonness-tier-quota-diverged",
      entries
        .filter((entry) => tiers.get(entry.id) === tier && evaluationEntryIds.has(entry.id))
        .map((entry) => entry.id),
    )),
  });
}
