import { catalogEntryFrequencyWeight } from "../commonness/catalog-projection.js";
import {
  lexicalCompatibilityMultiplier,
  surfaceCompatibilityScore,
  type LexicalCompatibilityIndex,
} from "../compatibility/lexical-pairs.js";
import type { CatalogEntry, RandomSource } from "../core/model.js";
import type {
  GrammarCompositionResult,
  GrammarUtteranceCandidate,
} from "../grammar/types.js";
import type { StructuralLexicalSlot } from "../syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
  realizeStructuralDerivation,
} from "../syntax/realize.js";
import {
  sampleStructuralDerivation,
  type StructuralRuleOrderer,
} from "../syntax/sample.js";
import type {
  DerivationBounds,
  ProductionRule,
  RuntimeSyntaxProfile,
} from "../syntax/types.js";
import {
  chooseSentenceConstructionVariant,
  createFormalSyntaxFamilyRuleOrderer,
  createSentenceConstructionFamilyPlan,
  rootFamilyAttemptBudget,
  type SentenceConstructionFamilyPlan,
} from "./formal-syntax-sampling-policy.js";

export type FormalSyntaxSamplingMode = "raw" | "product-family";

export interface FormalSyntaxUtteranceInput {
  readonly eligibleEntries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly random: RandomSource;
  readonly entryWeightsById?: Readonly<Record<string, number>>;
  readonly lexicalCompatibility?: LexicalCompatibilityIndex;
  readonly lexicalCompatibilityMaximumBoost?: number;
  readonly minimumLexicalEntries?: number;
  readonly maximumCandidates: number;
  readonly maximumAttempts: number;
  readonly rules?: readonly ProductionRule[];
  readonly bounds?: DerivationBounds;
  /**
   * Product-family sampling is inferred for the complete formal grammar and raw
   * sampling for custom grammars. Callers may make that choice explicit. Passing
   * the complete FORMAL_SYNTAX_RULES explicitly does not change the mode.
   */
  readonly samplingMode?: FormalSyntaxSamplingMode;
  /** Raw/research-only ordering override. It cannot be combined with product-family mode. */
  readonly ruleOrderer?: StructuralRuleOrderer | null;
}

function nextUnit(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("RandomSource.next() must return a finite value in [0, 1)");
  }
  return value;
}

function defaultEntryWeight(entry: CatalogEntry): number {
  return catalogEntryFrequencyWeight(entry);
}

function weightedIndex(
  weights: readonly number[],
  random: RandomSource,
): number | null {
  if (weights.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("formal syntax entry weights must be finite and non-negative");
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  let target = nextUnit(random) * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= weights[index] ?? 0;
    if (target < 0) return index;
  }
  return weights.length - 1;
}

function isPracticeLexicalSlot(slot: StructuralLexicalSlot): boolean {
  return slot.formalLiteral === undefined
    && !(slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT");
}

function selectCompatibleProfile(
  compatible: readonly RuntimeSyntaxProfile[],
  usedEntryIds: ReadonlySet<string>,
  reusableEntryId: string | undefined,
  entriesById: ReadonlyMap<string, CatalogEntry>,
  entryWeightsById: Readonly<Record<string, number>> | undefined,
  previousEntry: CatalogEntry | null,
  lexicalCompatibility: LexicalCompatibilityIndex | undefined,
  lexicalCompatibilityMaximumBoost: number,
  random: RandomSource,
): RuntimeSyntaxProfile | null {
  const profilesByEntryId = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of compatible) {
    if (usedEntryIds.has(profile.entryId) && profile.entryId !== reusableEntryId) continue;
    const profiles = profilesByEntryId.get(profile.entryId) ?? [];
    profiles.push(profile);
    profilesByEntryId.set(profile.entryId, profiles);
  }
  const entryIds = [...profilesByEntryId.keys()];
  const selectedEntryIndex = weightedIndex(entryIds.map((entryId) => {
    const entry = entriesById.get(entryId);
    if (entry === undefined) throw new Error(`formal syntax profile references missing entry ${entryId}`);
    const baseWeight = entryWeightsById?.[entry.id] ?? defaultEntryWeight(entry);
    if (previousEntry === null || lexicalCompatibility === undefined) return baseWeight;
    const score = surfaceCompatibilityScore(
      lexicalCompatibility,
      previousEntry.prompt.text,
      entry.prompt.text,
    );
    return baseWeight * lexicalCompatibilityMultiplier(
      score,
      lexicalCompatibilityMaximumBoost,
    );
  }), random);
  if (selectedEntryIndex === null) return null;
  const selectedEntryId = entryIds[selectedEntryIndex];
  if (selectedEntryId === undefined) throw new Error("formal syntax entry selection failed");
  const entryProfiles = profilesByEntryId.get(selectedEntryId) ?? [];
  if (entryProfiles.length === 0) throw new Error("formal syntax profile group is empty");
  const selectedProfileIndex = entryProfiles.length === 1
    ? 0
    : Math.floor(nextUnit(random) * entryProfiles.length);
  return entryProfiles[selectedProfileIndex] ?? null;
}

function punctuationForPath(path: readonly string[]): "。" | "！" | "？" {
  if (path.some((id) => id.includes("question"))) return "？";
  if (path.some((id) => id === "sentence.exclamative")) return "！";
  return "。";
}

function sameRuleIdSet(
  left: readonly ProductionRule[],
  right: readonly ProductionRule[],
): boolean {
  if (left.length !== right.length) return false;
  const leftIds = new Set(left.map((rule) => rule.id));
  const rightIds = new Set(right.map((rule) => rule.id));
  if (leftIds.size !== left.length || rightIds.size !== right.length) return false;
  return leftIds.size === rightIds.size && [...leftIds].every((ruleId) => rightIds.has(ruleId));
}

function inferredSamplingMode(rules: readonly ProductionRule[]): FormalSyntaxSamplingMode {
  return sameRuleIdSet(rules, FORMAL_SYNTAX_RULES) ? "product-family" : "raw";
}

export function composeFormalSyntaxUtterances(
  input: FormalSyntaxUtteranceInput,
): GrammarCompositionResult {
  if (!Number.isInteger(input.maximumCandidates) || input.maximumCandidates <= 0) {
    throw new Error("maximumCandidates must be a positive integer");
  }
  if (!Number.isInteger(input.maximumAttempts) || input.maximumAttempts <= 0) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  const minimumLexicalEntries = input.minimumLexicalEntries ?? 1;
  if (!Number.isInteger(minimumLexicalEntries) || minimumLexicalEntries <= 0) {
    throw new Error("minimumLexicalEntries must be a positive integer");
  }
  const compatibilityMaximumBoost = input.lexicalCompatibilityMaximumBoost ?? 1;
  if (!Number.isFinite(compatibilityMaximumBoost) || compatibilityMaximumBoost < 0) {
    throw new Error("lexicalCompatibilityMaximumBoost must be finite and non-negative");
  }
  const eligibleEntryIds = new Set(input.eligibleEntries.map((entry) => entry.id));
  const eligibleProfiles = input.profiles.filter((profile) => eligibleEntryIds.has(profile.entryId));
  const index = buildLexicalProfileIndex(input.eligibleEntries, eligibleProfiles);
  const entriesById = new Map(input.eligibleEntries.map((entry) => [entry.id, entry]));
  const rules = input.rules ?? FORMAL_SYNTAX_RULES;
  const samplingMode = input.samplingMode ?? inferredSamplingMode(rules);
  const useProductFamilyPolicy = samplingMode === "product-family";
  if (useProductFamilyPolicy && !sameRuleIdSet(rules, FORMAL_SYNTAX_RULES)) {
    throw new Error("product-family sampling requires the complete formal syntax rule set");
  }
  if (useProductFamilyPolicy && input.ruleOrderer !== undefined && input.ruleOrderer !== null) {
    throw new Error("product-family sampling cannot be combined with a custom ruleOrderer");
  }
  const familyRuleOrderer = useProductFamilyPolicy ? createFormalSyntaxFamilyRuleOrderer() : null;
  const ruleOrderer: StructuralRuleOrderer | undefined = useProductFamilyPolicy
    ? (orderingInput) => orderingInput.category === "Sentence"
      ? null
      : familyRuleOrderer!(orderingInput)
    : input.ruleOrderer ?? undefined;
  const sentenceRules = useProductFamilyPolicy
    ? rules.filter((rule) => rule.output === "Sentence")
    : [];
  let rootFamilyPlan: readonly SentenceConstructionFamilyPlan[] | null = null;
  let rootFamilyIndex = 0;
  let attemptsInRootFamily = 0;
  let attemptsPerRootFamily = 0;
  let rootFamilyBudgetInsufficient = false;

  const currentRootFamily = (remainingAttempts: number): SentenceConstructionFamilyPlan | null => {
    if (!useProductFamilyPolicy) return null;
    if (rootFamilyPlan === null) {
      rootFamilyPlan = createSentenceConstructionFamilyPlan(sentenceRules, input.random);
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      rootFamilyBudgetInsufficient = remainingAttempts < rootFamilyPlan.length;
      if (rootFamilyBudgetInsufficient) return null;
      attemptsPerRootFamily = rootFamilyAttemptBudget(remainingAttempts, rootFamilyPlan.length);
    }
    return rootFamilyPlan[rootFamilyIndex] ?? null;
  };
  const recordRootFamilyFailure = (): void => {
    if (!useProductFamilyPolicy) return;
    attemptsInRootFamily += 1;
    if (attemptsInRootFamily >= attemptsPerRootFamily) {
      rootFamilyIndex += 1;
      attemptsInRootFamily = 0;
    }
  };
  const resetRootFamilySearch = (): void => {
    rootFamilyPlan = null;
    rootFamilyIndex = 0;
    attemptsInRootFamily = 0;
    attemptsPerRootFamily = 0;
    rootFamilyBudgetInsufficient = false;
  };

  const candidates = new Map<string, GrammarUtteranceCandidate>();
  const fallbackReasons = new Set<string>();

  for (let attempt = 0;
    attempt < input.maximumAttempts && candidates.size < input.maximumCandidates;
    attempt += 1) {
    const rootFamily = currentRootFamily(input.maximumAttempts - attempt);
    if (useProductFamilyPolicy && rootFamily === null) {
      fallbackReasons.add(rootFamilyBudgetInsufficient
        ? "formal-syntax-root-family-budget-insufficient"
        : "formal-syntax-root-family-search-exhausted");
      break;
    }
    const rootProductionRuleId = rootFamily === null
      ? undefined
      : chooseSentenceConstructionVariant(rootFamily, input.random);
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: input.random,
      maximumAttempts: 1,
      isLexicalSlotReachable: (slot) => {
        if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
        return compatibleProfilesForSlot(slot, index).length > 0;
      },
      ...(input.bounds === undefined ? {} : { bounds: input.bounds }),
      ...(ruleOrderer === undefined ? {} : { ruleOrderer }),
      ...(rootProductionRuleId === undefined ? {} : { rootProductionRuleId }),
    });
    if (shape === null) {
      fallbackReasons.add("formal-syntax-structural-sampling-exhausted");
      recordRootFamilyFailure();
      continue;
    }
    if (shape.lexicalSlots.filter(isPracticeLexicalSlot).length < minimumLexicalEntries) {
      fallbackReasons.add("formal-syntax-under-minimum-lexical-entries");
      recordRootFamilyFailure();
      continue;
    }
    const offsets: Record<string, number> = {};
    const usedEntryIds = new Set<string>();
    const entryIdByBinding = new Map<string, string>();
    let previousEntry: CatalogEntry | null = null;
    let unrealizable = false;
    for (const slot of shape.lexicalSlots) {
      if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") {
        previousEntry = null;
        continue;
      }
      const allCompatible = compatibleProfilesForSlot(slot, index);
      const boundEntryId = slot.entryBindingId === undefined
        ? undefined
        : entryIdByBinding.get(slot.entryBindingId);
      const compatible = boundEntryId === undefined
        ? allCompatible
        : allCompatible.filter((profile) => profile.entryId === boundEntryId);
      const selectedProfile = selectCompatibleProfile(
        compatible,
        usedEntryIds,
        boundEntryId,
        entriesById,
        input.entryWeightsById,
        previousEntry,
        input.lexicalCompatibility,
        compatibilityMaximumBoost,
        input.random,
      );
      if (selectedProfile === null) {
        unrealizable = true;
        break;
      }
      const selectedIndex = allCompatible.findIndex((profile) => profile.id === selectedProfile.id);
      if (selectedIndex < 0) throw new Error("formal syntax compatible profile selection failed");
      const selectedEntry = entriesById.get(selectedProfile.entryId);
      if (selectedEntry === undefined) {
        throw new Error(`formal syntax selected missing entry ${selectedProfile.entryId}`);
      }
      if (slot.entryBindingId !== undefined) {
        const existing = entryIdByBinding.get(slot.entryBindingId);
        if (existing !== undefined && existing !== selectedProfile.entryId) {
          throw new Error("formal syntax lexical binding drift");
        }
        entryIdByBinding.set(slot.entryBindingId, selectedProfile.entryId);
      }
      offsets[slot.id] = selectedIndex;
      usedEntryIds.add(selectedProfile.entryId);
      previousEntry = selectedEntry;
    }
    if (unrealizable) {
      fallbackReasons.add("formal-syntax-unrealizable-shape");
      recordRootFamilyFailure();
      continue;
    }
    const punctuation = punctuationForPath(shape.productionRulePath);
    const realization = realizeStructuralDerivation(shape, {
      entries: input.eligibleEntries,
      profiles: eligibleProfiles,
      profileOffsetsBySlotId: offsets,
      punctuationToken: punctuation,
    });
    if (realization === null) {
      fallbackReasons.add("formal-syntax-realization-failed");
      recordRootFamilyFailure();
      continue;
    }
    const entries = realization.entryIds.map((entryId) => {
      const entry = entriesById.get(entryId);
      if (entry === undefined) throw new Error(`formal syntax selected missing entry ${entryId}`);
      return entry;
    });
    const text = realization.tokens
      .filter((token) => token.kind === "lexical-entry")
      .map((token) => token.value)
      .join("");
    const hasPunctuation = realization.tokens.some((token) => token.kind === "punctuation");
    const sizeBefore = candidates.size;
    candidates.set(realization.id, {
      id: realization.id,
      kind: "formal-syntax",
      templateId: null,
      entries,
      assignments: [],
      text,
      punctuation: hasPunctuation ? punctuation : null,
      syntaxDerivationId: realization.derivationId,
      syntaxRootRuleId: shape.root.productionRuleId,
      syntaxProfileIds: realization.syntaxProfileIds,
    });
    if (candidates.size > sizeBefore) {
      resetRootFamilySearch();
    } else {
      fallbackReasons.add("formal-syntax-duplicate-candidate");
      recordRootFamilyFailure();
    }
  }

  if (candidates.size === 0) fallbackReasons.add("formal-syntax-no-candidate");
  return {
    candidates: [...candidates.values()],
    fallbackReasons: [...fallbackReasons].sort(),
  };
}
