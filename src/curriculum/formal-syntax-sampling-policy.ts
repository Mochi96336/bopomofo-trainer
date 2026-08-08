import type { RandomSource } from "../core/model.js";
import type { StructuralRuleOrderer } from "../syntax/sample.js";
import type { ProductionRule } from "../syntax/types.js";
import {
  clauseConstructionClassification,
  sentenceConstructionClassification,
  type ClauseConstructionFamily,
  type ClauseKind,
  type SentenceConstructionFamily,
  type SentenceKind,
} from "./formal-syntax-taxonomy.js";

export interface FormalSyntaxSamplingPolicy {
  readonly version: string;
  readonly sentenceKindWeights: Readonly<Record<SentenceKind, number>>;
  readonly sentenceFamilyWeights: Readonly<Record<SentenceConstructionFamily, number>>;
  readonly clauseKindWeights: Readonly<Record<ClauseKind, number>>;
  readonly clauseFamilyWeights: Readonly<Record<ClauseConstructionFamily, number>>;
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

export const CLAUSE_KINDS: readonly ClauseKind[] = [
  "core-predication",
  "marked",
  "complex-predicate",
  "information-structure",
  "embedded-content",
];
export const CLAUSE_FAMILIES_BY_KIND: Readonly<Record<ClauseKind, readonly ClauseConstructionFamily[]>> = {
  "core-predication": [
    "core.nominal-predicate",
    "core.adjective-predicate",
    "core.intransitive",
    "core.transitive",
    "core.ditransitive",
    "core.copular",
    "core.existential",
    "core.locative",
  ],
  marked: [
    "marked.modal",
    "marked.negative",
    "marked.aspect",
    "marked.ba",
    "marked.bei",
    "marked.comparative",
  ],
  "complex-predicate": [
    "complex.causative",
    "complex.pivotal",
    "complex.serial-verb",
  ],
  "information-structure": [
    "information.topic-comment",
    "information.subject-omission",
    "information.object-omission",
  ],
  "embedded-content": [
    "embedded.subject-content",
    "embedded.object-content",
    "embedded.complement-content",
    "embedded.quoted-content",
  ],
};
export const CLAUSE_CONSTRUCTION_FAMILIES: readonly ClauseConstructionFamily[] =
  CLAUSE_KINDS.flatMap((kind) => CLAUSE_FAMILIES_BY_KIND[kind]);

/**
 * Training prior, not a claim about corpus sentence frequencies.
 *
 * Kinds and construction families own probability. Executable variants are
 * implementation choices inside that family and never create extra family mass
 * or extra attempts.
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
  clauseKindWeights: {
    "core-predication": 0.60,
    marked: 0.20,
    "complex-predicate": 0.08,
    "information-structure": 0.07,
    "embedded-content": 0.05,
  },
  clauseFamilyWeights: {
    "core.nominal-predicate": 1,
    "core.adjective-predicate": 1,
    "core.intransitive": 1,
    "core.transitive": 1,
    "core.ditransitive": 1,
    "core.copular": 1,
    "core.existential": 1,
    "core.locative": 1,
    "marked.modal": 1,
    "marked.negative": 1,
    "marked.aspect": 1,
    "marked.ba": 1,
    "marked.bei": 1,
    "marked.comparative": 1,
    "complex.causative": 1,
    "complex.pivotal": 1,
    "complex.serial-verb": 1,
    "information.topic-comment": 1,
    "information.subject-omission": 1,
    "information.object-omission": 1,
    "embedded.subject-content": 1,
    "embedded.object-content": 1,
    "embedded.complement-content": 1,
    "embedded.quoted-content": 1,
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
  assertWeightMap("clause kind", CLAUSE_KINDS, policy.clauseKindWeights);
  assertWeightMap("clause family", CLAUSE_CONSTRUCTION_FAMILIES, policy.clauseFamilyWeights);
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

interface HierarchicalClassification {
  readonly kind: string;
  readonly family: string;
}

interface GenericFamilyPlan {
  readonly kind: string;
  readonly family: string;
  readonly productionRuleIds: readonly string[];
}

function hierarchicalFamilyPlan(
  candidates: readonly ProductionRule[],
  classify: (ruleId: string) => HierarchicalClassification | null,
  kindWeights: Readonly<Record<string, number>>,
  familyWeights: Readonly<Record<string, number>>,
  random: RandomSource,
): readonly GenericFamilyPlan[] {
  const byKind = new Map<string, Map<string, ProductionRule[]>>();
  for (const rule of candidates) {
    const classification = classify(rule.id);
    if (classification === null) {
      throw new Error(`formal syntax sampling policy has no taxonomy for ${rule.id}`);
    }
    const byFamily = byKind.get(classification.kind) ?? new Map<string, ProductionRule[]>();
    const variants = byFamily.get(classification.family) ?? [];
    variants.push(rule);
    byFamily.set(classification.family, variants);
    byKind.set(classification.kind, byFamily);
  }

  const result: GenericFamilyPlan[] = [];
  const orderedKinds = weightedPermutation(
    [...byKind.keys()],
    (kind) => kindWeights[kind] ?? Number.NaN,
    random,
  );
  for (const kind of orderedKinds) {
    const byFamily = byKind.get(kind)!;
    const orderedFamilies = weightedPermutation(
      [...byFamily.keys()],
      (family) => familyWeights[family] ?? Number.NaN,
      random,
    );
    for (const family of orderedFamilies) {
      result.push({
        kind,
        family,
        productionRuleIds: [...byFamily.get(family)!].map((rule) => rule.id).sort(),
      });
    }
  }
  return result;
}

export interface SentenceConstructionFamilyPlan {
  readonly kind: SentenceKind;
  readonly family: SentenceConstructionFamily;
  readonly productionRuleIds: readonly string[];
}

export function createSentenceConstructionFamilyPlan(
  candidates: readonly ProductionRule[],
  random: RandomSource,
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): readonly SentenceConstructionFamilyPlan[] {
  validateFormalSyntaxSamplingPolicy(policy);
  return hierarchicalFamilyPlan(
    candidates,
    sentenceConstructionClassification,
    policy.sentenceKindWeights,
    policy.sentenceFamilyWeights,
    random,
  ).map((item) => ({
    kind: item.kind as SentenceKind,
    family: item.family as SentenceConstructionFamily,
    productionRuleIds: item.productionRuleIds,
  }));
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

function hierarchicalRuleOrder(
  candidates: readonly ProductionRule[],
  classify: (ruleId: string) => HierarchicalClassification | null,
  kindWeights: Readonly<Record<string, number>>,
  familyWeights: Readonly<Record<string, number>>,
  random: RandomSource,
): readonly ProductionRule[] {
  const byId = new Map(candidates.map((rule) => [rule.id, rule]));
  return hierarchicalFamilyPlan(
    candidates,
    classify,
    kindWeights,
    familyWeights,
    random,
  ).flatMap((item) => weightedPermutation(
    item.productionRuleIds.map((ruleId) => byId.get(ruleId)!),
    () => 1,
    random,
  ));
}

export function createFormalSyntaxFamilyRuleOrderer(
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): StructuralRuleOrderer {
  validateFormalSyntaxSamplingPolicy(policy);
  return ({ category, candidates, random }) => {
    if (category === "Sentence") {
      return hierarchicalRuleOrder(
        candidates,
        sentenceConstructionClassification,
        policy.sentenceKindWeights,
        policy.sentenceFamilyWeights,
        random,
      );
    }
    if (category === "Clause") {
      return hierarchicalRuleOrder(
        candidates,
        clauseConstructionClassification,
        policy.clauseKindWeights,
        policy.clauseFamilyWeights,
        random,
      );
    }
    return null;
  };
}

function normalizedWeight(
  keys: readonly string[],
  weights: Readonly<Record<string, number>>,
  selected: string,
): number {
  const total = keys.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  return total > 0 ? (weights[selected] ?? 0) / total : 0;
}

/** Nominal prior before reachability/failover effects. */
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
