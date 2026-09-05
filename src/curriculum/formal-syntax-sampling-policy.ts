import type { RandomSource } from "../core/model.js";
import { stableRuntimeDigest } from "../core/stable-id.js";
import { FORMAL_SYNTAX_RULES } from "../syntax/grammar.js";
import type { ProductionRule } from "../syntax/types.js";
import {
  sentenceConstructionClassification,
  type SentenceConstructionFamily,
  type SentenceKind,
} from "./formal-syntax-taxonomy.js";

export type PredicateMarkingPracticeIntent = "ordinary" | "negation";

export const PREDICATE_MARKING_PRACTICE_TICKET_VERSION =
  "predicate-marking-practice-ticket-v1";

export interface PredicateMarkingPracticeWeights {
  readonly ordinary: number;
  readonly negation: number;
}

export interface FormalSyntaxSamplingPolicy {
  readonly version: string;
  readonly sentenceKindWeights: Readonly<Record<SentenceKind, number>>;
  /** Omitted families remain classified by taxonomy but are inactive in product sampling. */
  readonly sentenceFamilyWeights: Readonly<Partial<Record<SentenceConstructionFamily, number>>>;
  /** Product practice intent for predicate-internal marking, separate from grammar legality. */
  readonly predicateMarkingPracticeWeights: PredicateMarkingPracticeWeights;
}

export const SENTENCE_KINDS: readonly SentenceKind[] = [
  "statement", "question", "request", "exclamative",
];

function canonicalSentenceKindByFamily(): ReadonlyMap<SentenceConstructionFamily, SentenceKind> {
  const result = new Map<SentenceConstructionFamily, SentenceKind>();
  for (const rule of FORMAL_SYNTAX_RULES) {
    if (rule.output !== "Sentence") continue;
    const classification = sentenceConstructionClassification(rule.id);
    if (classification === null) {
      throw new Error(`formal syntax sampling taxonomy has no Sentence classification for ${rule.id}`);
    }
    const existing = result.get(classification.family);
    if (existing !== undefined && existing !== classification.kind) {
      throw new Error(`sentence construction family ${classification.family} spans multiple kinds`);
    }
    result.set(classification.family, classification.kind);
  }
  return result;
}

const SENTENCE_KIND_BY_FAMILY = canonicalSentenceKindByFamily();

/** Canonical families come from the #154 taxonomy/grammar classification, not a second mapping. */
export const SENTENCE_CONSTRUCTION_FAMILIES: readonly SentenceConstructionFamily[] =
  [...SENTENCE_KIND_BY_FAMILY.keys()];

/**
 * Sentence-root training prior, not a claim about corpus sentence frequencies.
 *
 * Only families present in sentenceFamilyWeights are active. Taxonomy may contain
 * additional legal families that the current product derivation bounds do not
 * activate yet.
 */
export const PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY: FormalSyntaxSamplingPolicy = {
  version: "formal-syntax-family-sampling-v5",
  sentenceKindWeights: {
    statement: 0.64,
    question: 0.26,
    request: 0.06,
    exclamative: 0.04,
  },
  sentenceFamilyWeights: {
    // sentence.complex is intentionally inactive while product maximumClauseNesting is 1.
    "statement.declarative": 1,
    "question.polar": 0.35,
    "question.a-not-a": 0.25,
    "question.alternative": 0.10,
    "question.constituent": 0.30,
    request: 1,
    exclamative: 1,
  },
  // Product-practice prior measured after Clause-level negation retirement.
  // Structural-slot calibration counts realized `polarity: negative` requirements
  // directly, excluding A-not-A and profile-compatible non-negation occurrences.
  // A 3.01% marking ticket produced 199/2048 negative derivations versus the
  // same-meter pre-retirement 200/2048 baseline without restoring a negation root family.
  predicateMarkingPracticeWeights: { ordinary: 0.9699, negation: 0.0301 },
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

function assertExactWeightMap(
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

function activeSentenceFamiliesUnchecked(
  policy: FormalSyntaxSamplingPolicy,
): readonly SentenceConstructionFamily[] {
  return SENTENCE_CONSTRUCTION_FAMILIES.filter((family) =>
    policy.sentenceFamilyWeights[family] !== undefined,
  );
}

export function activeSentenceConstructionFamilies(
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): readonly SentenceConstructionFamily[] {
  validateFormalSyntaxSamplingPolicy(policy);
  return activeSentenceFamiliesUnchecked(policy);
}

export function sentenceConstructionKind(
  family: SentenceConstructionFamily,
): SentenceKind {
  const kind = SENTENCE_KIND_BY_FAMILY.get(family);
  if (kind === undefined) throw new Error(`unknown sentence construction family: ${family}`);
  return kind;
}

export function validateFormalSyntaxSamplingPolicy(policy: FormalSyntaxSamplingPolicy): void {
  if (policy.version.length === 0) throw new Error("formal syntax sampling policy version is required");
  assertExactWeightMap("sentence kind", SENTENCE_KINDS, policy.sentenceKindWeights);

  const configuredFamilies = Object.keys(policy.sentenceFamilyWeights) as SentenceConstructionFamily[];
  const knownFamilies = new Set<string>(SENTENCE_CONSTRUCTION_FAMILIES);
  const unknownFamilies = configuredFamilies.filter((family) => !knownFamilies.has(family));
  if (unknownFamilies.length > 0) {
    throw new Error(`sentence family weights contain unknown families: ${unknownFamilies.join(",")}`);
  }
  for (const family of configuredFamilies) {
    const weight = policy.sentenceFamilyWeights[family];
    if (weight === undefined || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`sentence family weight for ${family} must be finite and positive`);
    }
  }
  for (const kind of SENTENCE_KINDS) {
    const activeForKind = configuredFamilies.filter((family) => sentenceConstructionKind(family) === kind);
    if (activeForKind.length === 0) {
      throw new Error(`sentence kind ${kind} has positive mass but no active construction families`);
    }
  }
  const marking = policy.predicateMarkingPracticeWeights;
  if ([marking.ordinary, marking.negation].some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("predicate marking practice weights must be finite and non-negative");
  }
  if (!(marking.ordinary > 0 || marking.negation > 0)) {
    throw new Error("predicate marking practice weights require positive mass");
  }
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
  keys: readonly SentenceConstructionFamily[],
  weights: Readonly<Partial<Record<SentenceConstructionFamily, number>>>,
  selected: SentenceConstructionFamily,
): number {
  const total = keys.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  return total > 0 ? (weights[selected] ?? 0) / total : 0;
}

function sentenceFamilyJointWeight(
  family: SentenceConstructionFamily,
  policy: FormalSyntaxSamplingPolicy,
): number {
  const familyWeight = policy.sentenceFamilyWeights[family];
  if (familyWeight === undefined) return 0;
  const kind = sentenceConstructionKind(family);
  const activeInKind = activeSentenceFamiliesUnchecked(policy)
    .filter((candidate) => sentenceConstructionKind(candidate) === kind);
  const kindTotal = SENTENCE_KINDS.reduce(
    (sum, candidate) => sum + policy.sentenceKindWeights[candidate],
    0,
  );
  return policy.sentenceKindWeights[kind] / kindTotal
    * normalizedWeight(activeInKind, policy.sentenceFamilyWeights, family);
}

/** Nominal Sentence-root prior before reachability/failover effects; inactive families return zero. */
export function sentenceConstructionFamilyPrior(
  family: SentenceConstructionFamily,
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): number {
  validateFormalSyntaxSamplingPolicy(policy);
  sentenceConstructionKind(family);
  return sentenceFamilyJointWeight(family, policy);
}

export interface SentenceConstructionFamilyPlan {
  readonly kind: SentenceKind;
  readonly family: SentenceConstructionFamily;
  readonly productionRuleIds: readonly string[];
}

function deterministicPracticeUnit(identity: unknown): number {
  const digest = stableRuntimeDigest(identity);
  return (Number.parseInt(digest.slice(0, 8), 16) >>> 0) / 0x1_0000_0000;
}

/**
 * Choose a product marking intent from the already-randomized Sentence family plan
 * without consuming another parent RNG draw. The ticket therefore cannot move the
 * root-family PRNG trajectory merely by being enabled.
 */
export function predicateMarkingPracticeIntentForFamilyPlan(
  plan: readonly SentenceConstructionFamilyPlan[],
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): PredicateMarkingPracticeIntent {
  validateFormalSyntaxSamplingPolicy(policy);
  const weights = policy.predicateMarkingPracticeWeights;
  if (weights.negation === 0) return "ordinary";
  if (weights.ordinary === 0) return "negation";
  const ticket = deterministicPracticeUnit({
    ticketVersion: PREDICATE_MARKING_PRACTICE_TICKET_VERSION,
    purpose: "predicate-marking-practice",
    familyPlan: plan.map((item) => ({
      kind: item.kind,
      family: item.family,
      productionRuleIds: item.productionRuleIds,
    })),
  });
  return ticket * (weights.ordinary + weights.negation) < weights.ordinary
    ? "ordinary"
    : "negation";
}

/**
 * Build one weighted permutation over active Sentence construction families using
 * the joint family prior P(kind) × P(family | kind). Legal but inactive families
 * stay in the grammar/taxonomy and receive no product root attempts.
 */
export function createSentenceConstructionFamilyPlan(
  candidates: readonly ProductionRule[],
  random: RandomSource,
  policy: FormalSyntaxSamplingPolicy = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
): readonly SentenceConstructionFamilyPlan[] {
  validateFormalSyntaxSamplingPolicy(policy);
  const activeFamilies = new Set(activeSentenceFamiliesUnchecked(policy));
  const byFamily = new Map<SentenceConstructionFamily, SentenceConstructionFamilyPlan>();
  for (const rule of candidates) {
    const classification = sentenceConstructionClassification(rule.id);
    if (classification === null) {
      throw new Error(`formal syntax sampling policy has no taxonomy for ${rule.id}`);
    }
    if (!activeFamilies.has(classification.family)) continue;
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
  const missingActiveFamilies = [...activeFamilies].filter((family) => !byFamily.has(family));
  if (missingActiveFamilies.length > 0) {
    throw new Error(`active sentence construction families have no candidate rules: ${missingActiveFamilies.join(",")}`);
  }
  return weightedPermutation(
    [...byFamily.values()],
    (item) => sentenceFamilyJointWeight(item.family, policy),
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
 * Divide a bounded candidate-search budget across every currently active root
 * family. This is derived from the actual plan instead of assuming a fixed
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
