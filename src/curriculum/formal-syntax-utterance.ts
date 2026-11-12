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
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "../syntax/runtime-occurrence-capabilities.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForRequirements,
  compatibleProfilesForSlot,
  realizeStructuralDerivationWithIndex,
  type LexicalProfileIndex,
} from "../syntax/realize.js";
import {
  prepareStructuralSamplingContext,
  sampleStructuralDerivation,
  type NestedProductionTarget,
  type PreparedStructuralSamplingContext,
} from "../syntax/sample.js";
import { DEFAULT_DERIVATION_BOUNDS } from "../syntax/features.js";
import type {
  DerivationBounds,
  ProductionRule,
  RuntimeSyntaxProfile,
} from "../syntax/types.js";
import { createSeededRandom } from "./random.js";
import { selectLexicalProfile } from "./lexical-selection.js";
import { sentenceConstructionClassification } from "./formal-syntax-taxonomy.js";
import { prepareFormalSyntaxFeasibility } from "./formal-syntax-feasibility.js";
import { argumentRealizationStructuralPractice } from "./argument-realization-practice.js";
import {
  argumentRealizationPracticeIntentForTicketUnit,
  comparativePracticeIntentForTicketUnit,
  chooseSentenceConstructionVariant,
  createSentenceConstructionFamilyPlanSample,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  predicateMarkingPracticeIntentForTicketUnit,
  rootFamilyAttemptBudget,
  validateFormalSyntaxSamplingPolicy,
  type ArgumentRealizationPracticeIntent,
  type ComparativePracticeIntent,
  type FormalSyntaxSamplingPolicy,
  type PredicateMarkingPracticeIntent,
  type SentenceConstructionFamilyPlan,
} from "./formal-syntax-sampling-policy.js";

export type FormalSyntaxSamplingMode = "raw" | "product-family";

export interface FormalSyntaxStructuralTarget {
  readonly rootProductionRuleId?: string;
  readonly nestedProductionTargets?: readonly NestedProductionTarget[];
}

export interface FormalSyntaxUtteranceInput {
  /** Reading-identity mode exists for historical evidence replay. Production explicitly uses written-form. */
  readonly lexicalSampling?: "written-form" | "reading-identity";
  readonly eligibleEntries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly random: RandomSource;
  readonly entryWeightsById?: Readonly<Record<string, number>>;
  /** Lazy equivalent used when scoring only the compatible lexical frontier. */
  readonly entryWeight?: (entry: CatalogEntry) => number;
  readonly lexicalCompatibility?: LexicalCompatibilityIndex;
  /** Reviewed lexical-role/context license, applied before product weighting. */
  readonly readingEligibility?: (
    entry: CatalogEntry,
    profile: RuntimeSyntaxProfile,
    slot: StructuralLexicalSlot,
    previousEntry: CatalogEntry | null,
  ) => boolean;
  /**
   * Optional local pre-draw legality test. Applied to the current lexical
   * frontier before the learner/frequency-weighted pick, so an invalid
   * pronunciation never lends probability mass to a licensed word.
   * Omitted outside specifically reviewed contextual constructions.
   */
  readonly preDrawReadingEligibility?: FormalSyntaxUtteranceInput["readingEligibility"];
  /**
   * A reviewed identity restriction. Written-form product sampling combines
   * all such gates before weighting. Reading-identity historical replay applies
   * this gate ONLY to a fully realized, otherwise deliverable candidate. Invalid readings encountered
   * in ultimately failed attempts must not perturb a successful legal output.
   * The replacement is limited to the selected lexical slot and drawn from
   * its legal compatible candidates with their original weights.
   */
  readonly finalCandidateReadingEligibility?: FormalSyntaxUtteranceInput["readingEligibility"];
  /**
   * An optional, strictly later stage for a second exact identity restriction.
   * The first final-candidate repair must finish with its original candidate
   * frontier and weights before the next restriction is considered.
   */
  readonly subsequentFinalCandidateReadingEligibility?: FormalSyntaxUtteranceInput["readingEligibility"];
  /** Add later exact-identity repairs without changing earlier shipped repair frontiers. */
  readonly additionalFinalCandidateReadingEligibilities?: readonly NonNullable<
    FormalSyntaxUtteranceInput["readingEligibility"]
  >[];
  readonly lexicalCompatibilityMaximumBoost?: number;
  readonly minimumLexicalEntries?: number;
  readonly maximumCandidates: number;
  readonly maximumAttempts: number;
  readonly rules?: readonly ProductionRule[];
  readonly bounds?: DerivationBounds;
  /**
   * Product-family sampling is inferred only for the canonical complete formal
   * grammar and raw sampling for custom grammars. Callers may make that choice
   * explicit. Passing FORMAL_SYNTAX_RULES explicitly does not change the mode.
   */
  readonly samplingMode?: FormalSyntaxSamplingMode;
  /**
   * Curriculum policy injected at the composer boundary. It is valid only with
   * product-family mode; omitted input uses PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.
   */
  readonly samplingPolicy?: FormalSyntaxSamplingPolicy;
  /**
   * Explicit structural targeting for construction-specific practice. This is
   * raw-only: product-family mode owns Sentence family/root probability and may
   * not be bypassed by caller-selected production targets.
   */
  readonly structuralTarget?: FormalSyntaxStructuralTarget;
}

/** Immutable lexical preparation reusable while the entry/profile inputs stay unchanged. */
export interface PreparedFormalSyntaxLexicon {
  readonly eligibleEntries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly index: LexicalProfileIndex;
}

const preparedLexicons = new WeakMap<readonly CatalogEntry[],
  WeakMap<readonly RuntimeSyntaxProfile[], PreparedFormalSyntaxLexicon>>();

export function prepareFormalSyntaxLexicon(
  eligibleEntries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
): PreparedFormalSyntaxLexicon {
  let byProfiles = preparedLexicons.get(eligibleEntries);
  if (byProfiles === undefined) {
    byProfiles = new WeakMap();
    preparedLexicons.set(eligibleEntries, byProfiles);
  }
  const cached = byProfiles.get(profiles);
  if (cached !== undefined) return cached;
  const eligibleEntryIds = new Set(eligibleEntries.map((entry) => entry.id));
  const eligibleProfiles = profiles.filter((profile) => eligibleEntryIds.has(profile.entryId));
  const prepared = {
    eligibleEntries,
    profiles,
    index: buildLexicalProfileIndex(eligibleEntries, eligibleProfiles),
  };
  byProfiles.set(profiles, prepared);
  return prepared;
}

function defaultEntryWeight(entry: CatalogEntry): number {
  return catalogEntryFrequencyWeight(entry);
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
  entryWeight: ((entry: CatalogEntry) => number) | undefined,
  previousEntry: CatalogEntry | null,
  lexicalCompatibility: LexicalCompatibilityIndex | undefined,
  lexicalCompatibilityMaximumBoost: number,
  random: RandomSource,
  sampling: "written-form" | "reading-identity",
): RuntimeSyntaxProfile | null {
  return selectLexicalProfile({
    frontier: compatible, usedEntryIds, reusableEntryId, entriesById, random, sampling,
    ...(entryWeight === undefined && entryWeightsById === undefined
      && (previousEntry === null || lexicalCompatibility === undefined)
      ? { staticWeightKey: entriesById } : {}),
    weight: (entry) => {
      const base = entryWeight?.(entry) ?? entryWeightsById?.[entry.id] ?? defaultEntryWeight(entry);
      return previousEntry === null || lexicalCompatibility === undefined ? base
        : base * lexicalCompatibilityMultiplier(
          surfaceCompatibilityScore(lexicalCompatibility, previousEntry.prompt.text, entry.prompt.text),
          lexicalCompatibilityMaximumBoost,
        );
    },
  });
}

function punctuationForPath(path: readonly string[]): "。" | "！" | "？" {
  if (path.some((id) => id.includes("question"))) return "？";
  if (path.some((id) => id === "sentence.exclamative")) return "！";
  return "。";
}

function sameCanonicalRuleSet(
  rules: readonly ProductionRule[],
  canonicalRules: readonly ProductionRule[],
): boolean {
  if (rules === canonicalRules) return true;
  if (rules.length !== canonicalRules.length) return false;
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  if (byId.size !== rules.length) return false;
  return canonicalRules.every((canonicalRule) => {
    const candidate = byId.get(canonicalRule.id);
    return candidate !== undefined && JSON.stringify(candidate) === JSON.stringify(canonicalRule);
  });
}

function inferredSamplingMode(rules: readonly ProductionRule[]): FormalSyntaxSamplingMode {
  return sameCanonicalRuleSet(rules, FORMAL_SYNTAX_RULES) ? "product-family" : "raw";
}

export function composeFormalSyntaxUtterances(
  input: FormalSyntaxUtteranceInput,
  preparedLexicon?: PreparedFormalSyntaxLexicon,
  preparedStructuralContext?: PreparedStructuralSamplingContext,
): GrammarCompositionResult {
  if (!Number.isInteger(input.maximumCandidates) || input.maximumCandidates <= 0) {
    throw new Error("maximumCandidates must be a positive integer");
  }
  if (!Number.isInteger(input.maximumAttempts) || input.maximumAttempts <= 0) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  const finalPolicies = [input.finalCandidateReadingEligibility,
    input.subsequentFinalCandidateReadingEligibility,
    ...(input.additionalFinalCandidateReadingEligibilities ?? [])]
    .filter((gate): gate is NonNullable<FormalSyntaxUtteranceInput["readingEligibility"]> => gate !== undefined);
  const productReadingGates = [input.readingEligibility, input.preDrawReadingEligibility, ...finalPolicies]
    .filter((gate): gate is NonNullable<FormalSyntaxUtteranceInput["readingEligibility"]> => gate !== undefined);
  const minimumLexicalEntries = input.minimumLexicalEntries ?? 1;
  if (!Number.isInteger(minimumLexicalEntries) || minimumLexicalEntries <= 0) {
    throw new Error("minimumLexicalEntries must be a positive integer");
  }
  const compatibilityMaximumBoost = input.lexicalCompatibilityMaximumBoost ?? 1;
  if (!Number.isFinite(compatibilityMaximumBoost) || compatibilityMaximumBoost < 0) {
    throw new Error("lexicalCompatibilityMaximumBoost must be finite and non-negative");
  }
  if (preparedLexicon !== undefined
    && (preparedLexicon.eligibleEntries !== input.eligibleEntries
      || preparedLexicon.profiles !== input.profiles)) {
    throw new Error("prepared formal syntax lexicon input identity mismatch");
  }
  const index = (preparedLexicon
    ?? prepareFormalSyntaxLexicon(input.eligibleEntries, input.profiles)).index;
  const entriesById = index.entriesById;
  const rules = input.rules ?? FORMAL_SYNTAX_RULES;
  const samplingMode = input.samplingMode ?? inferredSamplingMode(rules);
  const useProductFamilyPolicy = samplingMode === "product-family";
  if (useProductFamilyPolicy && !sameCanonicalRuleSet(rules, FORMAL_SYNTAX_RULES)) {
    throw new Error("product-family sampling requires the canonical complete formal syntax rule set");
  }
  if (!useProductFamilyPolicy && input.samplingPolicy !== undefined) {
    throw new Error("samplingPolicy requires product-family sampling mode");
  }
  if (useProductFamilyPolicy && input.structuralTarget !== undefined) {
    throw new Error("structuralTarget requires raw sampling mode");
  }
  const samplingPolicy = useProductFamilyPolicy
    ? input.samplingPolicy ?? PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY
    : null;
  if (samplingPolicy !== null) validateFormalSyntaxSamplingPolicy(samplingPolicy);
  const effectiveMaximumClauseNesting =
    input.bounds?.maximumClauseNesting ?? DEFAULT_DERIVATION_BOUNDS.maximumClauseNesting;
  let preparedStructuralSamplingContext = preparedStructuralContext ?? null;
  const structuralSamplingContext = (): PreparedStructuralSamplingContext => {
    preparedStructuralSamplingContext ??= prepareStructuralSamplingContext(rules, input.bounds);
    return preparedStructuralSamplingContext;
  };

  // #155 deliberately controls Sentence-root family probability only. Nested
  // Clause/Phrase sampling stays on the raw structural sampler until a dedicated
  // nested family-local search contract exists. Raw construction practice may
  // inject explicit structural targets without changing product-family policy.
  const sentenceRules = useProductFamilyPolicy
    ? rules.filter((rule) => rule.output === "Sentence")
    : [];
  const feasibility = useProductFamilyPolicy && input.lexicalSampling === "written-form"
    ? prepareFormalSyntaxFeasibility(index, rules, structuralSamplingContext().bounds, minimumLexicalEntries)
    : null;
  if (feasibility !== null && !sentenceRules.some(rule => {
    const family = sentenceConstructionClassification(rule.id)?.family;
    return family !== undefined && samplingPolicy?.sentenceFamilyWeights[family] !== undefined
      && feasibility.eligibleRootRuleIds.has(rule.id);
  })) {
    return {
      candidates: [],
      fallbackReasons: ["formal-syntax-no-lexically-feasible-root"],
      rootAvailability: feasibility.roots,
    };
  }
  let rootFamilySearch: {
    readonly plan: readonly SentenceConstructionFamilyPlan[];
    readonly predicateMarkingPracticeIntent: PredicateMarkingPracticeIntent;
    readonly argumentRealizationPracticeIntent: ArgumentRealizationPracticeIntent;
    readonly comparativePracticeIntent: ComparativePracticeIntent;
    readonly availabilityFallbackReserved: boolean;
    readonly argumentRelaxationFallbackReserved: boolean;
    availabilityFallbackActive: boolean;
    argumentRelaxationFallbackActive: boolean;
  } | null = null;
  let rootFamilyIndex = 0;
  let attemptsInRootFamily = 0;
  let attemptsPerRootFamily = 0;
  let rootFamilyBudgetInsufficient = false;

  const currentRootFamily = (remainingAttempts: number): {
    readonly family: SentenceConstructionFamilyPlan;
    readonly predicateMarkingPracticeIntent: PredicateMarkingPracticeIntent;
    readonly argumentRealizationPracticeIntent: ArgumentRealizationPracticeIntent;
    readonly comparativePracticeIntent: ComparativePracticeIntent;
    readonly predicateMarkingAvailabilityFallbackActive: boolean;
    readonly argumentRealizationAvailabilityFallbackActive: boolean;
  } | null => {
    if (!useProductFamilyPolicy || samplingPolicy === null) return null;
    if (rootFamilySearch === null) {
      const planSample = createSentenceConstructionFamilyPlanSample(
        sentenceRules,
        input.random,
        samplingPolicy,
        feasibility?.eligibleRootRuleIds,
      );
      const plan = planSample.plan;
      const predicateMarkingPracticeIntent = predicateMarkingPracticeIntentForTicketUnit(
        planSample.predicateMarkingTicketUnit,
        samplingPolicy,
      );
      const argumentRealizationPracticeIntent = argumentRealizationPracticeIntentForTicketUnit(
        planSample.argumentRealizationTicketUnit,
        samplingPolicy,
      );
      const comparativePracticeIntent = comparativePracticeIntentForTicketUnit(
        planSample.comparativePracticeTicketUnit,
        samplingPolicy,
      );
      const availabilityFallbackReserved = (predicateMarkingPracticeIntent !== "ordinary"
        || argumentRealizationPracticeIntent !== "ordinary")
        && remainingAttempts >= plan.length * 2;
      // The new argument-realization axis may relax first, but must not erase an
      // already-selected Predicate-marking ticket. With enough budget, keep one
      // intermediate pass that preserves marking and relaxes only realization.
      const argumentRelaxationFallbackReserved = predicateMarkingPracticeIntent !== "ordinary"
        && argumentRealizationPracticeIntent !== "ordinary"
        && remainingAttempts >= plan.length * 3;
      const fallbackPlanCount = Number(availabilityFallbackReserved)
        + Number(argumentRelaxationFallbackReserved);
      const primaryAttempts = remainingAttempts - plan.length * fallbackPlanCount;
      rootFamilySearch = {
        plan,
        predicateMarkingPracticeIntent,
        argumentRealizationPracticeIntent,
        comparativePracticeIntent,
        availabilityFallbackReserved,
        argumentRelaxationFallbackReserved,
        availabilityFallbackActive: false,
        argumentRelaxationFallbackActive: false,
      };
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      rootFamilyBudgetInsufficient = primaryAttempts < plan.length;
      if (rootFamilyBudgetInsufficient) return null;
      attemptsPerRootFamily = rootFamilyAttemptBudget(primaryAttempts, plan.length);
    }
    let family = rootFamilySearch.plan[rootFamilyIndex];
    if (family === undefined
      && rootFamilySearch.argumentRelaxationFallbackReserved
      && !rootFamilySearch.argumentRelaxationFallbackActive
      && !rootFamilySearch.availabilityFallbackActive) {
      rootFamilySearch.argumentRelaxationFallbackActive = true;
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      attemptsPerRootFamily = 1;
      family = rootFamilySearch.plan[rootFamilyIndex];
    }
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
        ? "ordinary"
        : rootFamilySearch.predicateMarkingPracticeIntent,
      argumentRealizationPracticeIntent: (rootFamilySearch.argumentRelaxationFallbackActive
        || rootFamilySearch.availabilityFallbackActive)
        ? "ordinary"
        : rootFamilySearch.argumentRealizationPracticeIntent,
      comparativePracticeIntent: rootFamilySearch.comparativePracticeIntent,
      predicateMarkingAvailabilityFallbackActive: rootFamilySearch.availabilityFallbackActive
        && rootFamilySearch.predicateMarkingPracticeIntent !== "ordinary",
      argumentRealizationAvailabilityFallbackActive: (rootFamilySearch.argumentRelaxationFallbackActive
        || rootFamilySearch.availabilityFallbackActive)
        && rootFamilySearch.argumentRealizationPracticeIntent !== "ordinary",
    };
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
    rootFamilySearch = null;
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
    const rootFamilySelection = currentRootFamily(input.maximumAttempts - attempt);
    if (useProductFamilyPolicy && rootFamilySelection === null) {
      fallbackReasons.add(rootFamilyBudgetInsufficient
        ? "formal-syntax-root-family-budget-insufficient"
        : "formal-syntax-root-family-search-exhausted");
      break;
    }
    const rootFamily = rootFamilySelection?.family ?? null;
    const predicateMarkingPracticeIntent =
      rootFamilySelection?.predicateMarkingPracticeIntent ?? "ordinary";
    const argumentRealizationPracticeIntent =
      rootFamilySelection?.argumentRealizationPracticeIntent ?? "ordinary";
    const comparativePracticeIntent =
      rootFamilySelection?.comparativePracticeIntent ?? "adjectival";
    const requiredPredicateMarkingSlot = predicateMarkingPracticeIntent === "negation"
      ? {
          requiredFeatures: { polarity: "negative" as const },
          enclosingRequiredFunctions: ["predicate" as const],
        }
      : predicateMarkingPracticeIntent === "aspect"
        ? {
            requiredFeatures: { aspect: "marked" as const },
            enclosingRequiredFunctions: ["predicate" as const],
          }
        : predicateMarkingPracticeIntent === "modal"
          ? {
              requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
              enclosingRequiredFunctions: ["predicate" as const],
            }
          : null;
    const requiresPredicateMarkingPractice = requiredPredicateMarkingSlot !== null;
    const argumentRealizationPractice = useProductFamilyPolicy
      ? argumentRealizationStructuralPractice(argumentRealizationPracticeIntent)
      : null;
    const comparativePracticeTarget: NestedProductionTarget | null =
      useProductFamilyPolicy && comparativePracticeIntent !== "inactive"
        ? {
            parentRuleId: "clause.comparative",
            constituentKey: "predicate",
            childRuleId: comparativePracticeIntent === "verbal"
              ? "comparative-predicate.verbal"
              : "comparative-predicate.adjectival",
          }
        : null;
    // Grammar legality and product reachability are separate. A clausal
    // Subject needs two recursive clause-like edges (Subject -> ContentClause
    // -> Clause), so while the product nesting budget is below 2 it must not
    // enter child-rule sampling and perturb otherwise reachable Subject draws.
    const excludedProductionRuleIds = useProductFamilyPolicy
      ? [
          ...(comparativePracticeIntent === "inactive" ? ["clause.comparative"] : []),
          ...(effectiveMaximumClauseNesting < 2
            ? ["argument.subject.clause", "clause.relational-adjective-content"]
            : []),
        ]
      : [];
    const requiresArgumentRealizationPractice = argumentRealizationPracticeIntent !== "ordinary";
    if (rootFamilySelection?.predicateMarkingAvailabilityFallbackActive === true) {
      fallbackReasons.add("formal-syntax-predicate-marking-availability-fallback");
    }
    if (rootFamilySelection?.argumentRealizationAvailabilityFallbackActive === true) {
      fallbackReasons.add("formal-syntax-argument-realization-availability-fallback");
    }
    const rootProductionRuleId = rootFamily === null
      ? input.structuralTarget?.rootProductionRuleId
      : chooseSentenceConstructionVariant(rootFamily, input.random);
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: input.random,
      maximumAttempts: requiresPredicateMarkingPractice
        ? 32
        : requiresArgumentRealizationPractice
          ? 8
          : 1,
      ...(requiredPredicateMarkingSlot === null
        ? {}
        : { requiredLexicalSlot: requiredPredicateMarkingSlot }),
      ...(excludedProductionRuleIds.length === 0 ? {} : { excludedProductionRuleIds }),
      ...(argumentRealizationPractice?.requiredProductionRuleIdsAnyOf === undefined
        ? {}
        : { requiredProductionRuleIdsAnyOf: argumentRealizationPractice.requiredProductionRuleIdsAnyOf }),
      isLexicalRequirementsReachable: (constituent, requirements) => {
        if (constituent.formalLiteral !== undefined) return true;
        if (constituent.allowedUpos.length === 1 && constituent.allowedUpos[0] === "PUNCT") return true;
        return compatibleProfilesForRequirements(constituent, requirements, index).length > 0;
      },
      ...(input.bounds === undefined ? {} : { bounds: input.bounds }),
      ...(rootProductionRuleId === undefined ? {} : { rootProductionRuleId }),
      ...(useProductFamilyPolicy
        ? {
            nestedProductionTargets: [
              ...(argumentRealizationPractice?.nestedProductionTargets ?? []),
              ...(comparativePracticeTarget === null ? [] : [comparativePracticeTarget]),
            ],
          }
        : (input.structuralTarget?.nestedProductionTargets === undefined
            ? {}
            : { nestedProductionTargets: input.structuralTarget.nestedProductionTargets })),
    }, structuralSamplingContext());
    if (shape === null) {
      if (requiresPredicateMarkingPractice) {
        fallbackReasons.add("formal-syntax-predicate-marking-search-exhausted");
      }
      if (requiresArgumentRealizationPractice) {
        fallbackReasons.add("formal-syntax-argument-realization-search-exhausted");
      }
      if (!requiresPredicateMarkingPractice && !requiresArgumentRealizationPractice) {
        fallbackReasons.add("formal-syntax-structural-sampling-exhausted");
      }
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
      if (slot.formalLiteral !== undefined
        || (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT")) {
        previousEntry = null;
        continue;
      }
      const allCompatible = compatibleProfilesForSlot(slot, index);
      const boundEntryId = slot.entryBindingId === undefined
        ? undefined
        : entryIdByBinding.get(slot.entryBindingId);
      const boundCompatible = boundEntryId === undefined
        ? allCompatible
        : allCompatible.filter((profile) => profile.entryId === boundEntryId);
      // Product mode licenses the complete frontier before weighting.
      // Historical replay keeps the separately versioned local-repair behavior.
      const draw = (choices: readonly RuntimeSyntaxProfile[]) => selectCompatibleProfile(
        choices,
        usedEntryIds,
        boundEntryId,
        entriesById,
        input.entryWeightsById,
        input.entryWeight,
        previousEntry,
        input.lexicalCompatibility,
        compatibilityMaximumBoost,
        input.random, input.lexicalSampling ?? "reading-identity",
      );
      const readingEligibility = input.readingEligibility;
      const preDrawPolicy = input.preDrawReadingEligibility;
      const currentLegalFrontier = input.lexicalSampling === "written-form"
        ? boundCompatible.filter(profile => {
          const entry = entriesById.get(profile.entryId);
          if (entry === undefined) throw new Error("reading frontier references missing entry");
          return productReadingGates.every(gate => gate(entry, profile, slot, previousEntry));
        })
        : preDrawPolicy === undefined ? boundCompatible
        : boundCompatible.filter((profile) => {
            const entry = entriesById.get(profile.entryId);
            if (entry === undefined) {
              throw new Error("pre-draw reading policy references a missing catalog entry");
            }
            return preDrawPolicy(entry, profile, slot, previousEntry);
          });
      let selectedProfile = draw(currentLegalFrontier);
      if (input.lexicalSampling !== "written-form" && selectedProfile !== null && readingEligibility !== undefined) {
        const initiallySelected = entriesById.get(selectedProfile.entryId);
        if (initiallySelected === undefined) {
          throw new Error("formal syntax reading policy references a missing catalog entry");
        }
        if (!readingEligibility(initiallySelected, selectedProfile, slot, previousEntry)) {
          const licensed = boundCompatible.filter((profile) => {
            const entry = entriesById.get(profile.entryId);
            if (entry === undefined) {
              throw new Error("formal syntax reading policy references a missing catalog entry");
            }
            return readingEligibility(entry, profile, slot, previousEntry);
          });
          // Rejection redraw is limited to this lexical slot; the entire
          // sentence is not discarded. Draw from the legal frontier using
          // the original entry weights. An invalid reading's learner boost
          // must never be transferred to its written homograph.
          // Earlier reviewed role gates retain their existing local legal
          // redraw. The explicitly reviewed ordinal context is already
          // licensed BEFORE weighting, so it never borrows mass from ㄒㄧㄥ2.
          selectedProfile = draw(licensed);
        }
      }
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
    let realization = realizeStructuralDerivationWithIndex(shape, {
      index,
      profileOffsetsBySlotId: offsets,
      punctuationToken: punctuation,
    });
    if (realization === null) {
      fallbackReasons.add("formal-syntax-realization-failed");
      recordRootFamilyFailure();
      continue;
    }
    let entries = realization.entryIds.map((entryId) => {
      const entry = entriesById.get(entryId);
      if (entry === undefined) throw new Error(`formal syntax selected missing entry ${entryId}`);
      return entry;
    });
    // Historical evidence replay retains its ordered local repairs. Product
    // sampling filters every license before assigning any probability mass.
    const finalReadingPolicies = input.lexicalSampling === "written-form" ? [] : finalPolicies;
    if (input.lexicalSampling === "written-form") {
      const slots = shape.lexicalSlots.filter(isPracticeLexicalSlot);
      const licensed = entries.every((entry, at) => {
        const profile = compatibleProfilesForSlot(slots[at]!, index).find(p => p.id === realization!.syntaxProfileIds[at]);
        return profile !== undefined && productReadingGates.every(gate =>
          gate(entry, profile, slots[at]!, entries[at - 1] ?? null));
      });
      if (!licensed) {
        fallbackReasons.add("formal-syntax-reading-context-rejected");
        recordRootFamilyFailure();
        continue;
      }
    }
    for (let stage = 0; stage < finalReadingPolicies.length; stage += 1) {
      const finalReadingPolicy = finalReadingPolicies[stage]!;
      const previousFinalPolicies = finalReadingPolicies.slice(0,stage);
      const practiceSlots = shape.lexicalSlots.filter(isPracticeLexicalSlot);
      if (practiceSlots.length !== entries.length
        || realization.syntaxProfileIds.length !== entries.length) {
        throw new Error("final reading repair requires exact realized lexical-slot correspondence");
      }
      let repaired = false;
      // A-not-A and other identity-bound constructions reuse one lexical
      // identity in multiple practice slots. Update them as a single unit.
      const repairedBoundSlots = new Set<number>();
      for (let i = 0; i < entries.length; i += 1) {
        if (repairedBoundSlots.has(i)) continue;
        const entry = entries[i]!;
        const slot = practiceSlots[i]!;
        const compatible = compatibleProfilesForSlot(slot, index);
        const currentProfile = compatible.find((profile) =>
          profile.id === realization!.syntaxProfileIds[i]);
        if (currentProfile === undefined || currentProfile.entryId !== entry.id) {
          throw new Error("final reading repair cannot align selected profile with lexical slot");
        }
        const previous = i === 0 ? null : entries[i-1]!;
        if (finalReadingPolicy(entry, currentProfile, slot, previous)) continue;
        if (slot.entryBindingId !== undefined) {
          const bindingId = slot.entryBindingId;
          const group = practiceSlots.flatMap((member,at) =>
            member.entryBindingId === bindingId ? [at] : []);
          if (group.length < 2 || group.some(at => entries[at]!.id !== entry.id)) {
            throw new Error("bound final reading repair requires a consistent repeated entry identity");
          }
          // The replacement must be legal in EVERY bound position. In
          // particular, applying one local redraw while the other slot still
          // selects the forbidden entry would break the same-lexeme contract.
          const licensedBoundProfiles = compatible.filter((profile) => {
            const alternative = entriesById.get(profile.entryId);
            if (alternative === undefined) return false;
            return group.every(at => {
              const member = practiceSlots[at]!;
              const preceding = at === 0 ? null
                : group.includes(at-1) ? alternative : entries[at-1]!;
              return compatibleProfilesForSlot(member,index).some(boundProfile =>
                boundProfile.entryId === alternative.id
                  && (input.preDrawReadingEligibility?.(alternative,boundProfile,member,preceding) ?? true)
                  && (input.readingEligibility?.(alternative,boundProfile,member,preceding) ?? true)
                  && previousFinalPolicies.every(policy =>
                    policy(alternative,boundProfile,member,preceding))
                  && finalReadingPolicy(alternative,boundProfile,member,preceding));
            });
          });
          const usedOutsideBinding = new Set(
            entries.filter((_item,at) => !group.includes(at)).map(item=>item.id),
          );
          const selectedBound = selectCompatibleProfile(
            licensedBoundProfiles,usedOutsideBinding,undefined,
            entriesById,input.entryWeightsById,input.entryWeight,
            previous,input.lexicalCompatibility,compatibilityMaximumBoost,
            createSeededRandom("final-reading-redraw-v1:"
              + realization.id + ":" + slot.id + ":" + entry.id),
            input.lexicalSampling ?? "reading-identity",
          );
          if (selectedBound === null) {
            throw new Error("no permitted alternative for bound final candidate reading");
          }
          const newEntry = entriesById.get(selectedBound.entryId);
          if (newEntry === undefined) throw new Error("bound reading redraw references missing catalog entry");
          for (const at of group) {
            const member = practiceSlots[at]!;
            const frontier = compatibleProfilesForSlot(member,index);
            const preceding = at === 0 ? null
              : group.includes(at-1) ? newEntry : entries[at-1]!;
            const selected = frontier.find(p =>
              p.entryId === newEntry.id
                && (input.preDrawReadingEligibility?.(newEntry,p,member,preceding) ?? true)
                && (input.readingEligibility?.(newEntry,p,member,preceding) ?? true)
                && previousFinalPolicies.every(policy => policy(newEntry,p,member,preceding))
                && finalReadingPolicy(newEntry,p,member,preceding));
            if (selected === undefined) throw new Error("bound reading frontier drift");
            offsets[member.id] = frontier.findIndex(p => p.id === selected.id);
            entries[at] = newEntry;
            repairedBoundSlots.add(at);
          }
          repaired = true;
          continue;
        }
        const licensed = compatible.filter((profile) => {
          const alternative = entriesById.get(profile.entryId);
          // A late replacement must satisfy EVERY gate that the original
          // lexical draw already satisfied. Otherwise a different reading
          // (e.g. 和/ㄏㄨ2 in a conjunction slot) could be reintroduced.
          return alternative !== undefined
            && (input.preDrawReadingEligibility?.(alternative, profile, slot, previous) ?? true)
            && (input.readingEligibility?.(alternative, profile, slot, previous) ?? true)
            && previousFinalPolicies.every(policy => policy(alternative, profile, slot, previous))
            && finalReadingPolicy(alternative, profile, slot, previous);
        });
        const usedElsewhere = new Set(entries.filter((_item, at) => at !== i).map(item => item.id));
        const drawn = selectCompatibleProfile(
          licensed, usedElsewhere, undefined,
          entriesById, input.entryWeightsById, input.entryWeight,
          previous, input.lexicalCompatibility,
          compatibilityMaximumBoost,
          createSeededRandom("final-reading-redraw-v1:"
            + realization.id + ":" + slot.id + ":" + entry.id),
          input.lexicalSampling ?? "reading-identity",
        );
        if (drawn === null) {
          throw new Error("no permitted alternative for final candidate reading");
        }
        const replacementIndex = compatible.findIndex((profile) => profile.id === drawn.id);
        if (replacementIndex < 0) throw new Error("repaired profile not in original slot frontier");
        offsets[slot.id] = replacementIndex;
        entries[i] = entriesById.get(drawn.entryId)!;
        repaired = true;
      }
      if (repaired) {
        const updated = realizeStructuralDerivationWithIndex(shape, {
          index, profileOffsetsBySlotId: offsets, punctuationToken: punctuation,
        });
        if (updated === null) throw new Error("final candidate reading repair failed to realize");
        realization = updated;
        entries = realization.entryIds.map((id) => {
          const entry = entriesById.get(id);
          if (entry === undefined) throw new Error("repaired candidate contains missing catalog entry");
          return entry;
        });
        if (entries.some((entry, i) => {
          const slot = practiceSlots[i]!;
          const profile = compatibleProfilesForSlot(slot, index).find((p) =>
            p.id === realization!.syntaxProfileIds[i]);
          if (profile === undefined) return true;
          const previous = i === 0 ? null : entries[i-1]!;
          return !(input.preDrawReadingEligibility?.(entry, profile, slot, previous) ?? true)
            || !(input.readingEligibility?.(entry, profile, slot, previous) ?? true)
            || previousFinalPolicies.some(policy => !policy(entry, profile, slot, previous))
            || !finalReadingPolicy(entry, profile, slot, previous);
        })) {
          throw new Error("final candidate repair still contains an unapproved reading");
        }
      }
    }
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
      syntaxProductionRuleIds: shape.productionRulePath,
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
    ...(feasibility === null ? {} : { rootAvailability: feasibility.roots }),
  };
}
