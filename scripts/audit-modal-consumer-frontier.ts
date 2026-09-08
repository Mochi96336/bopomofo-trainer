import { catalogEntryFrequencyWeight } from "../src/commonness/catalog-projection.js";
import type { CatalogEntry, RandomSource } from "../src/core/model.js";
import {
  chooseSentenceConstructionVariant,
  createSentenceConstructionFamilyPlanSample,
  predicateMarkingPracticeIntentForTicketUnit,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  rootFamilyAttemptBudget,
  type PredicateMarkingPracticeIntent,
  type SentenceConstructionFamilyPlan,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../src/app/generated/catalog.js";
import type { StructuralLexicalSlot } from "../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
  realizeStructuralDerivation,
} from "../src/syntax/realize.js";
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "../src/syntax/runtime-occurrence-capabilities.js";
import { sampleStructuralDerivation } from "../src/syntax/sample.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../src/syntax/types.js";

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;
const MAXIMUM_ATTEMPTS = 64;
const MINIMUM_LEXICAL_ENTRIES = 2;
const SAMPLE_COUNT = Number(process.env.MODAL_AUDIT_SAMPLES ?? "2048");

if (!Number.isInteger(SAMPLE_COUNT) || SAMPLE_COUNT <= 0) {
  throw new Error("MODAL_AUDIT_SAMPLES must be a positive integer");
}

const entriesById = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry]));
const profileById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
const profileIndex = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const sentenceRules = FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence");

const predicateFrontier = SYNTAX_PROFILES.filter((profile) => profile.upos === "AUX");
const legacyFrontier = predicateFrontier.filter((profile) => profile.functions.includes("auxiliary"));
const reviewedFrontier = legacyFrontier.filter((profile) =>
  profile.occurrenceCapabilities?.includes(PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY) ?? false,
);
const predicateIds = new Set(predicateFrontier.map((profile) => profile.id));
const legacyIds = new Set(legacyFrontier.map((profile) => profile.id));
const reviewedIds = new Set(reviewedFrontier.map((profile) => profile.id));
const predicateOnlyIds = new Set([...predicateIds].filter((id) => !legacyIds.has(id)));
const legacyOnlyIds = new Set([...legacyIds].filter((id) => !reviewedIds.has(id)));

function profileRows(profiles: readonly RuntimeSyntaxProfile[]) {
  return profiles
    .map((profile) => ({
      profileId: profile.id,
      entryId: profile.entryId,
      text: textByEntryId.get(profile.entryId) ?? "<missing>",
      functions: profile.functions,
      occurrenceCapabilities: profile.occurrenceCapabilities ?? [],
    }))
    .sort((left, right) => left.text.localeCompare(right.text, "zh-Hant") || left.profileId.localeCompare(right.profileId));
}

function nextUnit(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("RandomSource.next() must return a finite value in [0, 1)");
  }
  return value;
}

function weightedIndex(weights: readonly number[], random: RandomSource): number | null {
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

function isPredicateModalSlot(slot: StructuralLexicalSlot): boolean {
  return slot.constituentKey === "modal"
    && slot.allowedUpos.length === 1
    && slot.allowedUpos[0] === "AUX"
    && !slot.requiredFunctions.includes("auxiliary");
}

function isClauseModalSlot(slot: StructuralLexicalSlot): boolean {
  return slot.constituentKey === "modal"
    && slot.allowedUpos.length === 1
    && slot.allowedUpos[0] === "AUX"
    && slot.requiredFunctions.includes("auxiliary");
}

type Strategy = "current" | "narrow-predicate" | "narrow-and-retire-clause";

function rulesForStrategy(strategy: Strategy): readonly ProductionRule[] {
  return strategy === "narrow-and-retire-clause"
    ? FORMAL_SYNTAX_RULES.filter((rule) => rule.id !== "clause.modal")
    : FORMAL_SYNTAX_RULES;
}

function compatibleForStrategy(
  slot: StructuralLexicalSlot,
  strategy: Strategy,
): readonly RuntimeSyntaxProfile[] {
  const compatible = compatibleProfilesForSlot(slot, profileIndex);
  if (strategy === "current" || !isPredicateModalSlot(slot)) return compatible;
  return compatible.filter((profile) => reviewedIds.has(profile.id));
}

function selectCompatibleProfile(
  compatible: readonly RuntimeSyntaxProfile[],
  usedEntryIds: ReadonlySet<string>,
  reusableEntryId: string | undefined,
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
    if (entry === undefined) throw new Error(`missing entry ${entryId}`);
    return catalogEntryFrequencyWeight(entry);
  }), random);
  if (selectedEntryIndex === null) return null;
  const selectedEntryId = entryIds[selectedEntryIndex];
  if (selectedEntryId === undefined) return null;
  const entryProfiles = profilesByEntryId.get(selectedEntryId) ?? [];
  if (entryProfiles.length === 0) return null;
  const profileIndexValue = entryProfiles.length === 1
    ? 0
    : Math.floor(nextUnit(random) * entryProfiles.length);
  return entryProfiles[profileIndexValue] ?? null;
}

function punctuationForPath(path: readonly string[]): "。" | "！" | "？" {
  if (path.some((id) => id.includes("question"))) return "？";
  if (path.some((id) => id === "sentence.exclamative")) return "！";
  return "。";
}

interface SlotSelection {
  readonly constituentKey: string;
  readonly requiredFunctions: readonly string[];
  readonly profileId: string;
  readonly entryId: string;
  readonly text: string;
  readonly kind: "predicate-modal" | "clause-modal" | "other";
}

interface ReplayTrace {
  readonly success: boolean;
  readonly realizationId: string | null;
  readonly derivationId: string | null;
  readonly text: string | null;
  readonly rootRuleId: string | null;
  readonly productionRulePath: readonly string[];
  readonly slotSelections: readonly SlotSelection[];
  readonly fallbackReasons: readonly string[];
}

function replayOne(seed: string, strategy: Strategy): ReplayTrace {
  const random = createSeededRandom(seed);
  const rules = rulesForStrategy(strategy);
  const fallbackReasons = new Set<string>();
  let rootFamilySearch: {
    readonly plan: readonly SentenceConstructionFamilyPlan[];
    readonly predicateMarkingPracticeIntent: PredicateMarkingPracticeIntent;
    readonly availabilityFallbackReserved: boolean;
    availabilityFallbackActive: boolean;
  } | null = null;
  let rootFamilyIndex = 0;
  let attemptsInRootFamily = 0;
  let attemptsPerRootFamily = 0;
  let rootFamilyBudgetInsufficient = false;

  const currentRootFamily = (remainingAttempts: number) => {
    if (rootFamilySearch === null) {
      const planSample = createSentenceConstructionFamilyPlanSample(
        sentenceRules,
        random,
        PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      );
      const predicateMarkingPracticeIntent = predicateMarkingPracticeIntentForTicketUnit(
        planSample.predicateMarkingTicketUnit,
        PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      );
      const availabilityFallbackReserved = predicateMarkingPracticeIntent === "negation"
        && remainingAttempts >= planSample.plan.length * 2;
      const primaryAttempts = remainingAttempts
        - (availabilityFallbackReserved ? planSample.plan.length : 0);
      rootFamilySearch = {
        plan: planSample.plan,
        predicateMarkingPracticeIntent,
        availabilityFallbackReserved,
        availabilityFallbackActive: false,
      };
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      rootFamilyBudgetInsufficient = primaryAttempts < planSample.plan.length;
      if (rootFamilyBudgetInsufficient) return null;
      attemptsPerRootFamily = rootFamilyAttemptBudget(primaryAttempts, planSample.plan.length);
    }
    let family = rootFamilySearch.plan[rootFamilyIndex];
    if (family === undefined
      && rootFamilySearch.availabilityFallbackReserved
      && !rootFamilySearch.availabilityFallbackActive) {
      rootFamilySearch.availabilityFallbackActive = true;
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      attemptsPerRootFamily = 1;
      family = rootFamilySearch.plan[rootFamilyIndex];
    }
    if (family === undefined) return null;
    return {
      family,
      predicateMarkingPracticeIntent: rootFamilySearch.availabilityFallbackActive
        ? "ordinary" as const
        : rootFamilySearch.predicateMarkingPracticeIntent,
      availabilityFallbackActive: rootFamilySearch.availabilityFallbackActive,
    };
  };

  const recordRootFamilyFailure = () => {
    attemptsInRootFamily += 1;
    if (attemptsInRootFamily >= attemptsPerRootFamily) {
      rootFamilyIndex += 1;
      attemptsInRootFamily = 0;
    }
  };

  for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
    const rootFamilySelection = currentRootFamily(MAXIMUM_ATTEMPTS - attempt);
    if (rootFamilySelection === null) {
      fallbackReasons.add(rootFamilyBudgetInsufficient
        ? "formal-syntax-root-family-budget-insufficient"
        : "formal-syntax-root-family-search-exhausted");
      break;
    }
    const requiresNegationPractice = rootFamilySelection.predicateMarkingPracticeIntent === "negation";
    if (rootFamilySelection.availabilityFallbackActive) {
      fallbackReasons.add("formal-syntax-predicate-marking-availability-fallback");
    }
    const rootProductionRuleId = chooseSentenceConstructionVariant(rootFamilySelection.family, random);
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random,
      maximumAttempts: requiresNegationPractice ? 8 : 1,
      ...(requiresNegationPractice
        ? {
            requiredLexicalSlot: {
              requiredFeatures: { polarity: "negative" },
              enclosingRequiredFunctions: ["predicate"],
            },
          }
        : {}),
      isLexicalSlotReachable: (slot) => {
        if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
        return compatibleForStrategy(slot, strategy).length > 0;
      },
      bounds: PRODUCT_BOUNDS,
      rootProductionRuleId,
    });
    if (shape === null) {
      fallbackReasons.add(requiresNegationPractice
        ? "formal-syntax-predicate-marking-search-exhausted"
        : "formal-syntax-structural-sampling-exhausted");
      recordRootFamilyFailure();
      continue;
    }
    if (shape.lexicalSlots.filter(isPracticeLexicalSlot).length < MINIMUM_LEXICAL_ENTRIES) {
      fallbackReasons.add("formal-syntax-under-minimum-lexical-entries");
      recordRootFamilyFailure();
      continue;
    }

    const offsets: Record<string, number> = {};
    const usedEntryIds = new Set<string>();
    const entryIdByBinding = new Map<string, string>();
    const slotSelections: SlotSelection[] = [];
    let unrealizable = false;
    for (const slot of shape.lexicalSlots) {
      if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") continue;
      const allCompatible = compatibleForStrategy(slot, strategy);
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
        random,
      );
      if (selectedProfile === null) {
        unrealizable = true;
        break;
      }
      const selectedIndex = allCompatible.findIndex((profile) => profile.id === selectedProfile.id);
      if (selectedIndex < 0) throw new Error("selected profile missing from compatible set");
      offsets[slot.id] = selectedIndex;
      usedEntryIds.add(selectedProfile.entryId);
      if (slot.entryBindingId !== undefined) entryIdByBinding.set(slot.entryBindingId, selectedProfile.entryId);
      slotSelections.push({
        constituentKey: slot.constituentKey,
        requiredFunctions: slot.requiredFunctions,
        profileId: selectedProfile.id,
        entryId: selectedProfile.entryId,
        text: textByEntryId.get(selectedProfile.entryId) ?? "<missing>",
        kind: isPredicateModalSlot(slot)
          ? "predicate-modal"
          : isClauseModalSlot(slot)
            ? "clause-modal"
            : "other",
      });
    }
    if (unrealizable) {
      fallbackReasons.add("formal-syntax-unrealizable-shape");
      recordRootFamilyFailure();
      continue;
    }

    const punctuation = punctuationForPath(shape.productionRulePath);
    const realization = realizeStructuralDerivation(shape, {
      entries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      profileOffsetsBySlotId: offsets,
      punctuationToken: punctuation,
    });
    if (realization === null) {
      fallbackReasons.add("formal-syntax-realization-failed");
      recordRootFamilyFailure();
      continue;
    }
    const text = realization.tokens
      .filter((token) => token.kind === "lexical-entry")
      .map((token) => token.value)
      .join("");
    return {
      success: true,
      realizationId: realization.id,
      derivationId: realization.derivationId,
      text,
      rootRuleId: shape.root.productionRuleId,
      productionRulePath: shape.productionRulePath,
      slotSelections,
      fallbackReasons: [...fallbackReasons].sort(),
    };
  }

  fallbackReasons.add("formal-syntax-no-candidate");
  return {
    success: false,
    realizationId: null,
    derivationId: null,
    text: null,
    rootRuleId: null,
    productionRulePath: [],
    slotSelections: [],
    fallbackReasons: [...fallbackReasons].sort(),
  };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedRecord(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map].sort(([left], [right]) => left.localeCompare(right, "zh-Hant")));
}

function totalVariationCount(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): number {
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys].reduce((sum, key) => sum + Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0)), 0) / 2;
}

interface StrategyAggregate {
  success: number;
  clauseModalPath: number;
  predicateExpandedPath: number;
  predicateModalOutput: number;
  clauseModalOutput: number;
  predicateModalSlots: number;
  clauseModalSlots: number;
  readonly rootCounts: Map<string, number>;
  readonly fallbackCounts: Map<string, number>;
  readonly predicateModalForms: Map<string, number>;
  readonly clauseModalForms: Map<string, number>;
  predicateModalReviewed: number;
  predicateModalLegacyOnly: number;
  predicateModalPredicateOnly: number;
  clauseModalReviewed: number;
  clauseModalLegacyOnly: number;
}

function emptyAggregate(): StrategyAggregate {
  return {
    success: 0,
    clauseModalPath: 0,
    predicateExpandedPath: 0,
    predicateModalOutput: 0,
    clauseModalOutput: 0,
    predicateModalSlots: 0,
    clauseModalSlots: 0,
    rootCounts: new Map(),
    fallbackCounts: new Map(),
    predicateModalForms: new Map(),
    clauseModalForms: new Map(),
    predicateModalReviewed: 0,
    predicateModalLegacyOnly: 0,
    predicateModalPredicateOnly: 0,
    clauseModalReviewed: 0,
    clauseModalLegacyOnly: 0,
  };
}

function recordTrace(target: StrategyAggregate, trace: ReplayTrace): void {
  if (trace.success) target.success += 1;
  if (trace.productionRulePath.includes("clause.modal")) target.clauseModalPath += 1;
  if (trace.productionRulePath.includes("predicate.verb.expanded")) target.predicateExpandedPath += 1;
  if (trace.rootRuleId !== null) increment(target.rootCounts, trace.rootRuleId);
  for (const reason of trace.fallbackReasons) increment(target.fallbackCounts, reason);
  const predicateModal = trace.slotSelections.filter((selection) => selection.kind === "predicate-modal");
  const clauseModal = trace.slotSelections.filter((selection) => selection.kind === "clause-modal");
  if (predicateModal.length > 0) target.predicateModalOutput += 1;
  if (clauseModal.length > 0) target.clauseModalOutput += 1;
  target.predicateModalSlots += predicateModal.length;
  target.clauseModalSlots += clauseModal.length;
  for (const selection of predicateModal) {
    increment(target.predicateModalForms, selection.text);
    if (reviewedIds.has(selection.profileId)) target.predicateModalReviewed += 1;
    else if (legacyOnlyIds.has(selection.profileId)) target.predicateModalLegacyOnly += 1;
    else if (predicateOnlyIds.has(selection.profileId)) target.predicateModalPredicateOnly += 1;
  }
  for (const selection of clauseModal) {
    increment(target.clauseModalForms, selection.text);
    if (reviewedIds.has(selection.profileId)) target.clauseModalReviewed += 1;
    else if (legacyOnlyIds.has(selection.profileId)) target.clauseModalLegacyOnly += 1;
  }
}

const currentAggregate = emptyAggregate();
const narrowAggregate = emptyAggregate();
const retiredAggregate = emptyAggregate();
let parityMismatches = 0;
let currentVsNarrowTextMismatch = 0;
let currentVsRetiredTextMismatch = 0;
let currentVsNarrowSuccessMismatch = 0;
let currentVsRetiredSuccessMismatch = 0;
let narrowVsRetiredTextMismatch = 0;

for (let round = 0; round < SAMPLE_COUNT; round += 1) {
  const seed = `modal-consumer-frontier:${round}`;
  const current = replayOne(seed, "current");
  const narrow = replayOne(seed, "narrow-predicate");
  const retired = replayOne(seed, "narrow-and-retire-clause");
  recordTrace(currentAggregate, current);
  recordTrace(narrowAggregate, narrow);
  recordTrace(retiredAggregate, retired);

  const official = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(seed),
    samplingMode: "product-family",
    minimumLexicalEntries: MINIMUM_LEXICAL_ENTRIES,
    maximumCandidates: 1,
    maximumAttempts: MAXIMUM_ATTEMPTS,
    bounds: PRODUCT_BOUNDS,
  });
  const officialCandidate = official.candidates[0];
  if ((officialCandidate === undefined) !== !current.success
    || officialCandidate?.id !== current.realizationId
    || officialCandidate?.syntaxDerivationId !== current.derivationId
    || officialCandidate?.text !== current.text) {
    parityMismatches += 1;
  }

  if (current.success !== narrow.success) currentVsNarrowSuccessMismatch += 1;
  if (current.success !== retired.success) currentVsRetiredSuccessMismatch += 1;
  if (current.text !== narrow.text) currentVsNarrowTextMismatch += 1;
  if (current.text !== retired.text) currentVsRetiredTextMismatch += 1;
  if (narrow.text !== retired.text) narrowVsRetiredTextMismatch += 1;
}

if (parityMismatches !== 0) {
  throw new Error(`audit replay diverged from product composer on ${parityMismatches}/${SAMPLE_COUNT} seeds`);
}

function summarize(target: StrategyAggregate) {
  return {
    success: target.success,
    clauseModalPath: target.clauseModalPath,
    predicateExpandedPath: target.predicateExpandedPath,
    predicateModalOutput: target.predicateModalOutput,
    clauseModalOutput: target.clauseModalOutput,
    predicateModalSlots: target.predicateModalSlots,
    clauseModalSlots: target.clauseModalSlots,
    predicateModalReviewed: target.predicateModalReviewed,
    predicateModalLegacyOnly: target.predicateModalLegacyOnly,
    predicateModalPredicateOnly: target.predicateModalPredicateOnly,
    clauseModalReviewed: target.clauseModalReviewed,
    clauseModalLegacyOnly: target.clauseModalLegacyOnly,
    rootCounts: sortedRecord(target.rootCounts),
    fallbackCounts: sortedRecord(target.fallbackCounts),
    predicateModalForms: sortedRecord(target.predicateModalForms),
    clauseModalForms: sortedRecord(target.clauseModalForms),
  };
}

const summary = {
  sampleCount: SAMPLE_COUNT,
  frontier: {
    predicateProfileCount: predicateFrontier.length,
    legacyProfileCount: legacyFrontier.length,
    reviewedProfileCount: reviewedFrontier.length,
    predicateOnlyCount: predicateOnlyIds.size,
    legacyOnlyUnreviewedCount: legacyOnlyIds.size,
    predicateOnly: profileRows(predicateFrontier.filter((profile) => predicateOnlyIds.has(profile.id))),
    legacyOnlyUnreviewed: profileRows(legacyFrontier.filter((profile) => legacyOnlyIds.has(profile.id))),
    reviewed: profileRows(reviewedFrontier),
  },
  current: summarize(currentAggregate),
  narrowPredicateShadow: summarize(narrowAggregate),
  narrowAndRetireClauseShadow: summarize(retiredAggregate),
  drift: {
    parityMismatches,
    currentVsNarrowSuccessMismatch,
    currentVsRetiredSuccessMismatch,
    currentVsNarrowTextMismatch,
    currentVsRetiredTextMismatch,
    narrowVsRetiredTextMismatch,
    currentVsNarrowRootTvCount: totalVariationCount(currentAggregate.rootCounts, narrowAggregate.rootCounts),
    currentVsRetiredRootTvCount: totalVariationCount(currentAggregate.rootCounts, retiredAggregate.rootCounts),
  },
};

console.log(JSON.stringify(summary, null, 2));
