import type { RandomSource } from "../core/model.js";
import type { ProductionRule } from "../syntax/types.js";
import {
  sentenceConstructionClassification,
  type SentenceConstructionFamily,
  type SentenceKind,
} from "./formal-syntax-taxonomy.js";

export interface FormalSyntaxSamplingPolicy {
  readonly version: string;
  readonly sentenceKindWeights: Readonly<Record<SentenceKind, number>>;
  readonly sentenceFamilyWeights: Readonly<Record<SentenceConstructionFamily, number>>;
}

export const SENTENCE_KINDS: readonly SentenceKind[] = [
  "statement", "question", "request", "exclamative",
];
export const SENTENCE_FAMILIES_BY_KIND: Readonly<Record<SentenceKind, readonly SentenceConstructionFamily[]>> = {
  statement: ["statement.declarative", "statement.complex"],
  question: [
    "question.polar",
    "question.a-not-a",
    "question.alternative",
    "question.constituent",
  ],
  request: ["request"],
  exclamative: ["exclamative"],
};
export const SENTENCE_CONSTRUCTION_FAMILIES: readonly SentenceConstructionFamily[] =
  SENTENCE_KINDS.flatMap((kind) => SENTENCE_FAMILIES_BY_KIND[kind]);

/**
 * Sentence-root training prior, not a claim about corpus sentence frequencies.
 *
 * Kinds and construction families own probability. Executable variants are
 * implementation choices inside that family and never create extra family mass
 * or extra root attempts.
 */
export const PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY: FormalSyntaxSamplingPolicy = {
  version: "formal-syntax-family-sampling-v2",
  sentenceKindWeights: {
    statement: 0.64,
    question: 0.26,
    request: 0.06,
    exclamative: 0.04,
  },
  sentenceFamilyWeights: {
    "statement.declarative": 0.85,
    "statement.complex": 0.15,
    "question.polar": 0.35,
    "question.a-not-a": 0.25,
    "question.alternative": 0.10,
    "question.constituent": 0.30,
    request: 1,
    exclamative: 1,
  },
};

function nextUnit(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("RandomSource.next() must return a finite value in [0, 1)");
  }
  return value;
}

function chooseIndex(random: RandomSource, size: number): number {
  if (!Number.isInteger(size) || size <= 0) throw new Error("sampling choice requires at least one value");
  return Math.min(size - 1, Math.floor(nextUnit(random) * size));
}

function assertWeightMap(
  label: string,
  expectedKeys: readonly string[],
  weights: Readonly<Record<string, number>>,
): void {
  const expected = new Set(expectedKeys);
  const actual = Object.keys(weights);
  const missing = expectedKeys.filter((key) => weights[key] === undefined);
  const unknown = actual.filter((key) => !expected.has(key));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `${label} keys mismatch: missing=[${missing.join(",")}] unknown=[${unknown.join(",")}]`,
    );
  }
  for (const key of expectedKeys) {
    const weight = weights[key];
    if (weight === undefined || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`${label} weight for ${key} must be finite and positive`);
    }
  }
}

export function validateFormalSyntaxSamplingPolicy(policy: FormalSyntaxSamplingPolicy): void {
  if (policy.version.length === 0) throw new Error("formal syntax sampling policy version is required");
  assertWeightMap("sentence kind", SENTENCE_KINDS, policy.sentenceKindWeights);
  assertWeightMap("sentence family", SENTENCE_CONSTRUCTION_FAMILIES, policy.sentenceFamilyWeights);
}

function weightedPermutation<T>(
  values: readonly T[],
  weightFor: (value: T) => number,
  random: RandomSource,
): readonly T[] {
  const pool = [...values];
  const result: T[] = [];
  while (pool.length > 0) {
    const weights = pool.map(weightFor);
    if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
      throw new Error("formal syntax sampling weights must be finite and positive");
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let target = nextUnit(random) * total;
    let selectedIndex = weights.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      target -= weights[index]!;
      if (target < 0) {
        selectedIndex = index;
        break;
      }
    }
    result.push(pool[selectedIndex]!);
    pool.splice(selectedIndex, 1);
  }
  return result;
}

function normalizedWeight(
  keys: readonly string[],
  weights: Readonly<Record<string, number>>,
  selected: string,
): number {
  const total = keys.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  return total > 0 ? (weights[selected] ?? 0) / total : 0;
}

/** Nominal Sentence-root prior before reachability/failover effects. */
export function sentenceConstructionFamilyPrior(
  family: SentenceConstructionFamily,
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): number {
  validateFormalSyntaxSamplingPolicy(policy);
  const kind = SENTENCE_KINDS.find((candidate) =>
    SENTENCE_FAMILIES_BY_KIND[candidate].includes(family),
  );
  if (kind === undefined) throw new Error(`unknown sentence construction family: ${family}`);
  return normalizedWeight(SENTENCE_KINDS, policy.sentenceKindWeights, kind)
    * normalizedWeight(SENTENCE_FAMILIES_BY_KIND[kind], policy.sentenceFamilyWeights, family);
}

export interface SentenceConstructionFamilyPlan {
  readonly kind: SentenceKind;
  readonly family: SentenceConstructionFamily;
  readonly productionRuleIds: readonly string[];
}

/**
 * Build one weighted permutation over Sentence construction families using the
 * joint family prior P(kind) × P(family | kind). Families from the same kind do
 * not receive contiguous fallback positions merely because they share a kind.
 */
export function createSentenceConstructionFamilyPlan(
  candidates: readonly ProductionRule[],
  random: RandomSource,
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): readonly SentenceConstructionFamilyPlan[] {
  validateFormalSyntaxSamplingPolicy(policy);
  const byFamily = new Map<SentenceConstructionFamily, SentenceConstructionFamilyPlan>();
  for (const rule of candidates) {
    const classification = sentenceConstructionClassification(rule.id);
    if (classification === null) {
      throw new Error(`formal syntax sampling policy has no taxonomy for ${rule.id}`);
    }
    const existing = byFamily.get(classification.family);
    if (existing !== undefined) {
      if (existing.kind !== classification.kind) {
        throw new Error(`sentence construction family ${classification.family} spans multiple kinds`);
      }
      byFamily.set(classification.family, {
        ...existing,
        productionRuleIds: [...existing.productionRuleIds, rule.id].sort(),
      });
      continue;
    }
    byFamily.set(classification.family, {
      kind: classification.kind,
      family: classification.family,
      productionRuleIds: [rule.id],
    });
  }
  return weightedPermutation(
    [...byFamily.values()],
    (item) => sentenceConstructionFamilyPrior(item.family, policy),
    random,
  );
}

/**
 * One family attempt gets exactly one executable root variant. A family with
 * more ProductionRules therefore does not receive more root-rule opportunities
 * per attempt.
 */
export function chooseSentenceConstructionVariant(
  family: SentenceConstructionFamilyPlan,
  random: RandomSource,
): string {
  const ids = family.productionRuleIds;
  if (ids.length === 0) throw new Error(`sentence construction family ${family.family} has no variants`);
  if (ids.length === 1) return ids[0]!;
  return ids[chooseIndex(random, ids.length)]!;
}

/**
 * Divide a bounded candidate-search budget across every currently available
 * root family. This is derived from the actual plan instead of assuming a fixed
 * family count. Fail closed if the caller cannot afford one attempt per family.
 */
export function rootFamilyAttemptBudget(
  maximumAttempts: number,
  familyCount: number,
): number {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts <= 0) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  if (!Number.isInteger(familyCount) || familyCount <= 0) {
    throw new Error("familyCount must be a positive integer");
  }
  if (maximumAttempts < familyCount) {
    throw new Error(
      `formal syntax candidate-search budget ${maximumAttempts} cannot cover ${familyCount} root families`,
    );
  }
  return Math.floor(maximumAttempts / familyCount);
}
