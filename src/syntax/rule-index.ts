import { sha256Canonical } from "../reference/importers/canonical-json.js";
import {
  effectiveConstituentMaximum,
  excludedClassesForConstituent,
  ruleAllowedByDerivationBounds,
} from "./derivation-limits.js";
import { DEFAULT_DERIVATION_BOUNDS, FORMAL_GRAMMAR_VERSION } from "./features.js";
import {
  EMPTY_SYNTAX_REQUIREMENTS,
  requirementsForConstituent,
  type SyntaxRequirements,
} from "./requirements.js";
import {
  syntaxProfileMatchesRequirements,
  unsupportedLexicalFeatureNames,
  unsupportedProfileFeatureNames,
} from "./profile-match.js";
import type {
  DerivationBounds,
  ProductionConstituent,
  ProductionRule,
  ProductionRuleClass,
  RuntimeSyntaxProfile,
  SyntaxCategory,
  Upos,
} from "./types.js";

export interface RankedSyntaxLexeme {
  readonly id: string;
  readonly text: string;
  readonly generalRank: number;
}

export type SyntaxRuleIndexStatus =
  | "indexed"
  | "no-ud-evidence"
  | "no-compatible-rule-position"
  | "no-reachable-sentence-rule";

export interface SyntaxRuleIndexEntry {
  readonly generalRank: number;
  readonly entryId: string;
  readonly text: string;
  readonly status: SyntaxRuleIndexStatus;
  readonly profileIds: readonly string[];
  readonly upos: readonly Upos[];
  readonly directPositionIds: readonly string[];
  readonly reachableRuleIds: readonly string[];
  readonly sentenceRuleIds: readonly string[];
}

export interface SyntaxRuleReachabilityEntry {
  readonly ruleId: string;
  readonly output: SyntaxCategory;
  readonly globallyRealizable: boolean;
  readonly blockerConstituentKeys: readonly string[];
  readonly unsupportedFeatureNames: readonly string[];
  readonly directCandidateCount: number;
  readonly reachableCandidateCount: number;
}

export interface SyntaxRuleIndex {
  readonly schemaVersion: "formal-syntax-rule-index-v1";
  readonly grammarVersion: typeof FORMAL_GRAMMAR_VERSION;
  readonly grammarRulesDigest: string;
  readonly derivationBoundsDigest: string;
  readonly candidateCount: number;
  readonly profileCount: number;
  readonly indexedCandidateCount: number;
  readonly noUdEvidenceCandidateCount: number;
  readonly noCompatibleRulePositionCandidateCount: number;
  readonly noReachableSentenceRuleCandidateCount: number;
  readonly globallyRealizableRuleCount: number;
  readonly entries: readonly SyntaxRuleIndexEntry[];
  readonly rules: readonly SyntaxRuleReachabilityEntry[];
  readonly determinismDigest: string;
}

interface AbstractState {
  readonly key: string;
  readonly category: SyntaxCategory;
  readonly requirements: SyntaxRequirements;
  readonly excludedRuleClasses: ReadonlySet<ProductionRuleClass>;
}

interface RuleEvaluation {
  readonly realizable: boolean;
  readonly blockerKeys: readonly string[];
  readonly participantEntryIds: ReadonlySet<string>;
  readonly lexicalEntryIdsByKey: ReadonlyMap<string, ReadonlySet<string>>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addAll(target: Set<string>, values: Iterable<string>): boolean {
  let changed = false;
  for (const value of values) {
    if (target.has(value)) continue;
    target.add(value);
    changed = true;
  }
  return changed;
}

function normalizedExcluded(
  values: ReadonlySet<ProductionRuleClass>,
): readonly ProductionRuleClass[] {
  return [...values].sort(compareText);
}

function stateKey(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  excludedRuleClasses: ReadonlySet<ProductionRuleClass>,
): string {
  return sha256Canonical({
    category,
    requirements,
    excludedRuleClasses: normalizedExcluded(excludedRuleClasses),
  });
}

function makeState(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  excludedRuleClasses: ReadonlySet<ProductionRuleClass>,
): AbstractState {
  return {
    key: stateKey(category, requirements, excludedRuleClasses),
    category,
    requirements,
    excludedRuleClasses,
  };
}

function isSyntheticPunctuation(constituent: ProductionConstituent): boolean {
  return constituent.category === "Lexeme"
    && constituent.allowedUpos.length === 1
    && constituent.allowedUpos[0] === "PUNCT";
}

function constituentUnsupportedFeatures(
  constituent: ProductionConstituent,
): readonly string[] {
  return constituent.category === "Lexeme"
    ? unsupportedLexicalFeatureNames(constituent.requiredFeatures)
    : unsupportedProfileFeatureNames(constituent.requiredFeatures);
}

function intersection(values: readonly ReadonlySet<string>[]): ReadonlySet<string> {
  if (values.length === 0) return new Set();
  const [first, ...rest] = values;
  if (first === undefined) return new Set();
  return new Set([...first].filter((value) => rest.every((set) => set.has(value))));
}

export function buildSyntaxRuleIndex(input: {
  readonly lexemes: readonly RankedSyntaxLexeme[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly rules: readonly ProductionRule[];
  readonly bounds?: DerivationBounds;
}): SyntaxRuleIndex {
  const bounds = input.bounds ?? DEFAULT_DERIVATION_BOUNDS;
  const lexemes = [...input.lexemes].sort((left, right) =>
    left.generalRank - right.generalRank || compareText(left.id, right.id)
  );
  const rules = [...input.rules].sort((left, right) => compareText(left.id, right.id));
  const profiles = [...input.profiles].sort((left, right) => compareText(left.id, right.id));
  const lexemeIds = new Set(lexemes.map((item) => item.id));
  const textByEntryId = new Map(lexemes.map((item) => [item.id, item.text]));
  if (lexemeIds.size !== lexemes.length) throw new Error("syntax rule index requires unique lexeme IDs");
  if (lexemes.some((item) => !item.text || !Number.isInteger(item.generalRank) || item.generalRank <= 0)) {
    throw new Error("syntax rule index requires non-empty text and positive integer ranks");
  }
  if (profiles.some((profile) => !lexemeIds.has(profile.entryId))) {
    throw new Error("syntax rule index profile references an unknown lexeme");
  }

  const profilesByEntry = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of profiles) {
    const values = profilesByEntry.get(profile.entryId) ?? [];
    values.push(profile);
    profilesByEntry.set(profile.entryId, values);
  }
  const rulesByOutput = new Map<SyntaxCategory, ProductionRule[]>();
  for (const rule of rules) {
    const values = rulesByOutput.get(rule.output) ?? [];
    values.push(rule);
    rulesByOutput.set(rule.output, values);
  }

  const lexicalEntriesFor = (
    constituent: ProductionConstituent,
    parentRequirements: SyntaxRequirements,
  ): ReadonlySet<string> => {
    if (constituent.formalLiteral !== undefined || isSyntheticPunctuation(constituent)) {
      return new Set();
    }
    const requirements = requirementsForConstituent(constituent, parentRequirements);
    if (requirements === null) return new Set();
    const matches = new Set<string>();
    for (const profile of profiles) {
      const text = textByEntryId.get(profile.entryId);
      if (text === undefined) continue;
      if (syntaxProfileMatchesRequirements(profile, {
        allowedUpos: constituent.allowedUpos,
        requiredFunctions: requirements.requiredFunctions,
        requiredValencyFrames: requirements.requiredValencyFrames,
        requiredFeatures: requirements.requiredFeatures,
      }, text)) {
        matches.add(profile.entryId);
      }
    }
    return matches;
  };

  const states = new Map<string, AbstractState>();
  const queue: AbstractState[] = [];
  const addState = (
    category: SyntaxCategory,
    requirements: SyntaxRequirements,
    excludedRuleClasses: ReadonlySet<ProductionRuleClass>,
  ): AbstractState => {
    const state = makeState(category, requirements, excludedRuleClasses);
    const existing = states.get(state.key);
    if (existing !== undefined) return existing;
    states.set(state.key, state);
    queue.push(state);
    return state;
  };
  for (const category of rulesByOutput.keys()) addState(category, EMPTY_SYNTAX_REQUIREMENTS, new Set());
  while (queue.length > 0) {
    const state = queue.shift()!;
    for (const rule of rulesByOutput.get(state.category) ?? []) {
      if (!ruleAllowedByDerivationBounds(rule, bounds, state.excludedRuleClasses)) continue;
      for (const constituent of rule.constituents) {
        if (constituent.category === "Lexeme") continue;
        const maximum = effectiveConstituentMaximum(constituent, bounds);
        if (maximum <= 0) continue;
        const childRequirements = requirementsForConstituent(constituent, state.requirements);
        if (childRequirements === null) continue;
        addState(
          constituent.category,
          childRequirements,
          excludedClassesForConstituent(constituent),
        );
      }
    }
  }

  const availableStates = new Set<string>();
  const participantsByState = new Map<string, Set<string>>();
  const availableRuleIdsByState = new Map<string, Set<string>>();

  const childStateFor = (
    constituent: ProductionConstituent,
    parentRequirements: SyntaxRequirements,
  ): AbstractState | null => {
    const childRequirements = requirementsForConstituent(constituent, parentRequirements);
    if (childRequirements === null) return null;
    const key = stateKey(
      constituent.category,
      childRequirements,
      excludedClassesForConstituent(constituent),
    );
    return states.get(key) ?? null;
  };

  const evaluateRule = (state: AbstractState, rule: ProductionRule): RuleEvaluation => {
    if (!ruleAllowedByDerivationBounds(rule, bounds, state.excludedRuleClasses)) {
      return {
        realizable: false,
        blockerKeys: rule.constituents.map((item) => item.key),
        participantEntryIds: new Set(),
        lexicalEntryIdsByKey: new Map(),
      };
    }
    const blockers = new Set<string>();
    const lexicalEntryIdsByKey = new Map<string, ReadonlySet<string>>();
    const childStatesByKey = new Map<string, AbstractState>();
    const bindingSets = new Map<string, ReadonlySet<string>[]>();

    for (const constituent of rule.constituents) {
      const maximum = effectiveConstituentMaximum(constituent, bounds);
      if (maximum < constituent.minimum) {
        blockers.add(constituent.key);
        continue;
      }
      if (constituent.category === "Lexeme") {
        if (constituent.formalLiteral !== undefined || isSyntheticPunctuation(constituent)) {
          lexicalEntryIdsByKey.set(constituent.key, new Set());
          continue;
        }
        const candidates = lexicalEntriesFor(constituent, state.requirements);
        lexicalEntryIdsByKey.set(constituent.key, candidates);
        if (constituent.minimum > 0 && candidates.size === 0) blockers.add(constituent.key);
        if (constituent.entryBinding !== undefined) {
          const values = bindingSets.get(constituent.entryBinding) ?? [];
          values.push(candidates);
          bindingSets.set(constituent.entryBinding, values);
        }
        continue;
      }
      const childState = childStateFor(constituent, state.requirements);
      if (childState !== null) childStatesByKey.set(constituent.key, childState);
      if (constituent.minimum > 0
        && (childState === null || !availableStates.has(childState.key))) {
        blockers.add(constituent.key);
      }
    }

    const boundEntryIdsByBinding = new Map<string, ReadonlySet<string>>();
    for (const [binding, candidateSets] of bindingSets) {
      const common = intersection(candidateSets);
      boundEntryIdsByBinding.set(binding, common);
      if (common.size === 0) {
        for (const constituent of rule.constituents) {
          if (constituent.entryBinding === binding) blockers.add(constituent.key);
        }
      }
    }
    if (blockers.size > 0) {
      return {
        realizable: false,
        blockerKeys: [...blockers].sort(compareText),
        participantEntryIds: new Set(),
        lexicalEntryIdsByKey,
      };
    }

    const participants = new Set<string>();
    for (const constituent of rule.constituents) {
      const maximum = effectiveConstituentMaximum(constituent, bounds);
      if (maximum <= 0) continue;
      if (constituent.category === "Lexeme") {
        if (constituent.entryBinding !== undefined) {
          addAll(participants, boundEntryIdsByBinding.get(constituent.entryBinding) ?? []);
        } else {
          addAll(participants, lexicalEntryIdsByKey.get(constituent.key) ?? []);
        }
        continue;
      }
      const childState = childStatesByKey.get(constituent.key);
      if (childState !== undefined && availableStates.has(childState.key)) {
        addAll(participants, participantsByState.get(childState.key) ?? []);
      }
    }
    return {
      realizable: true,
      blockerKeys: [],
      participantEntryIds: participants,
      lexicalEntryIdsByKey,
    };
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const state of states.values()) {
      const stateParticipants = participantsByState.get(state.key) ?? new Set<string>();
      const stateRules = availableRuleIdsByState.get(state.key) ?? new Set<string>();
      for (const rule of rulesByOutput.get(state.category) ?? []) {
        const evaluation = evaluateRule(state, rule);
        if (!evaluation.realizable) continue;
        if (!availableStates.has(state.key)) {
          availableStates.add(state.key);
          changed = true;
        }
        if (!stateRules.has(rule.id)) {
          stateRules.add(rule.id);
          changed = true;
        }
        changed = addAll(stateParticipants, evaluation.participantEntryIds) || changed;
      }
      participantsByState.set(state.key, stateParticipants);
      availableRuleIdsByState.set(state.key, stateRules);
    }
  }

  const emptyStateFor = (category: SyntaxCategory): AbstractState | null => {
    const key = stateKey(category, EMPTY_SYNTAX_REQUIREMENTS, new Set());
    return states.get(key) ?? null;
  };

  const directPositionsByEntry = new Map<string, Set<string>>();
  const directEntriesByRule = new Map<string, Set<string>>();
  for (const state of states.values()) {
    if (!availableStates.has(state.key)) continue;
    const availableRules = availableRuleIdsByState.get(state.key) ?? new Set<string>();
    for (const rule of rulesByOutput.get(state.category) ?? []) {
      if (!availableRules.has(rule.id)) continue;
      const evaluation = evaluateRule(state, rule);
      if (!evaluation.realizable) continue;
      const bindingIntersections = new Map<string, ReadonlySet<string>>();
      for (const binding of new Set(
        rule.constituents.map((item) => item.entryBinding).filter((value): value is string => value !== undefined),
      )) {
        const sets = rule.constituents
          .filter((item) => item.entryBinding === binding)
          .map((item) => evaluation.lexicalEntryIdsByKey.get(item.key) ?? new Set<string>());
        bindingIntersections.set(binding, intersection(sets));
      }
      const directEntries = directEntriesByRule.get(rule.id) ?? new Set<string>();
      for (const constituent of rule.constituents) {
        if (constituent.category !== "Lexeme"
          || constituent.formalLiteral !== undefined
          || isSyntheticPunctuation(constituent)) continue;
        const candidates = constituent.entryBinding === undefined
          ? evaluation.lexicalEntryIdsByKey.get(constituent.key) ?? new Set<string>()
          : bindingIntersections.get(constituent.entryBinding) ?? new Set<string>();
        const positionId = `${rule.id}:${constituent.key}`;
        for (const entryId of candidates) {
          const positions = directPositionsByEntry.get(entryId) ?? new Set<string>();
          positions.add(positionId);
          directPositionsByEntry.set(entryId, positions);
          directEntries.add(entryId);
        }
      }
      directEntriesByRule.set(rule.id, directEntries);
    }
  }

  const participantsByGlobalRule = new Map<string, ReadonlySet<string>>();
  for (const rule of rules) {
    const state = emptyStateFor(rule.output);
    if (state === null) continue;
    const evaluation = evaluateRule(state, rule);
    if (!evaluation.realizable) continue;
    participantsByGlobalRule.set(rule.id, evaluation.participantEntryIds);
  }

  const reachableRuleIdsByEntry = new Map<string, Set<string>>();
  for (const [ruleId, participantEntryIds] of participantsByGlobalRule) {
    for (const entryId of participantEntryIds) {
      const values = reachableRuleIdsByEntry.get(entryId) ?? new Set<string>();
      values.add(ruleId);
      reachableRuleIdsByEntry.set(entryId, values);
    }
  }
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const entries: SyntaxRuleIndexEntry[] = lexemes.map((lexeme) => {
    const entryProfiles = profilesByEntry.get(lexeme.id) ?? [];
    const directPositionIds = [...(directPositionsByEntry.get(lexeme.id) ?? [])].sort(compareText);
    const reachableRuleIds = [...(reachableRuleIdsByEntry.get(lexeme.id) ?? [])].sort(compareText);
    const sentenceRuleIds = reachableRuleIds
      .filter((id) => rulesById.get(id)?.output === "Sentence")
      .sort(compareText);
    const status: SyntaxRuleIndexStatus = entryProfiles.length === 0
      ? "no-ud-evidence"
      : directPositionIds.length === 0
        ? "no-compatible-rule-position"
        : sentenceRuleIds.length === 0
          ? "no-reachable-sentence-rule"
          : "indexed";
    return {
      generalRank: lexeme.generalRank,
      entryId: lexeme.id,
      text: lexeme.text,
      status,
      profileIds: entryProfiles.map((profile) => profile.id).sort(compareText),
      upos: [...new Set(entryProfiles.map((profile) => profile.upos))].sort(compareText),
      directPositionIds,
      reachableRuleIds,
      sentenceRuleIds,
    };
  });

  const ruleEntries: SyntaxRuleReachabilityEntry[] = rules.map((rule) => {
    const state = emptyStateFor(rule.output);
    const evaluation = state === null ? null : evaluateRule(state, rule);
    const unsupportedFeatureNames = [...new Set(
      rule.constituents.flatMap(constituentUnsupportedFeatures),
    )].sort(compareText);
    return {
      ruleId: rule.id,
      output: rule.output,
      globallyRealizable: evaluation?.realizable ?? false,
      blockerConstituentKeys: evaluation?.blockerKeys
        ?? rule.constituents.map((item) => item.key).sort(compareText),
      unsupportedFeatureNames,
      directCandidateCount: directEntriesByRule.get(rule.id)?.size ?? 0,
      reachableCandidateCount: participantsByGlobalRule.get(rule.id)?.size ?? 0,
    };
  });

  const core = {
    schemaVersion: "formal-syntax-rule-index-v1" as const,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    grammarRulesDigest: sha256Canonical(rules),
    derivationBoundsDigest: sha256Canonical(bounds),
    candidateCount: entries.length,
    profileCount: profiles.length,
    indexedCandidateCount: entries.filter((item) => item.status === "indexed").length,
    noUdEvidenceCandidateCount: entries.filter((item) => item.status === "no-ud-evidence").length,
    noCompatibleRulePositionCandidateCount: entries
      .filter((item) => item.status === "no-compatible-rule-position").length,
    noReachableSentenceRuleCandidateCount: entries
      .filter((item) => item.status === "no-reachable-sentence-rule").length,
    globallyRealizableRuleCount: ruleEntries.filter((item) => item.globallyRealizable).length,
    entries,
    rules: ruleEntries,
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}
