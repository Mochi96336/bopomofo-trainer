import type { RandomSource } from "../core/model.js";
import { stableRuntimeDigest } from "../core/stable-id.js";
import {
  effectiveConstituentMaximum,
  excludedClassesForConstituent,
  ruleAllowedByDerivationBounds,
} from "./derivation-limits.js";
import { DEFAULT_DERIVATION_BOUNDS, FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  StructuralDerivationShape,
  StructuralElement,
  StructuralLexicalSlot,
  StructuralSyntaxNode,
} from "./derive.js";
import {
  validConstituentCountAssignments,
  type ConstituentCounts,
} from "./presence-constraints.js";
import {
  EMPTY_SYNTAX_REQUIREMENTS,
  requirementsForConstituent,
  type SyntaxRequirements,
} from "./requirements.js";
import type {
  DerivationBounds,
  ProductionConstituent,
  ProductionRule,
  ProductionRuleClass,
  SyntaxCategory,
} from "./types.js";
import { assertValidGrammar } from "./validate.js";

export const NESTED_CLAUSE_RULE_ORDER_VERSION = "stable-keyed-rule-substream-v2";

export interface NestedProductionTarget {
  readonly parentRuleId: string;
  readonly constituentKey: string;
  /** For a non-lexical constituent, constrain the production selected at this edge. */
  readonly childRuleId?: string;
  /** Constrain this constituent's multiplicity at the named parent production. */
  readonly exactCount?: number;
}

interface ValidatedNestedProductionTarget {
  readonly childRuleId?: string;
  readonly exactCount?: number;
}

export interface StructuralSamplingOptions {
  readonly rootCategory: SyntaxCategory;
  readonly rules: readonly ProductionRule[];
  readonly random: RandomSource;
  readonly bounds?: DerivationBounds;
  readonly maximumAttempts?: number;
  readonly isLexicalSlotReachable?: (slot: StructuralLexicalSlot) => boolean;
  /**
   * Target exactly one existing production at the root choice point. Descendant
   * categories still see the complete grammar. Restricting this API to one root
   * rule prevents a family with more executable variants from receiving extra
   * root-rule fallback opportunities inside one structural attempt.
   */
  readonly rootProductionRuleId?: string;
  /**
   * Target an existing child production only at a named parent constituent edge.
   * Other occurrences of the same child category remain unconstrained, including
   * recursively embedded occurrences below the targeted child.
   */
  readonly nestedProductionTargets?: readonly NestedProductionTarget[];
}

interface State {
  readonly remainingPhraseDepth: number;
  readonly remainingClauseDepth: number;
  readonly clauseCount: number;
  readonly lexicalCount: number;
}

interface Sampled {
  readonly element: StructuralElement;
  readonly state: State;
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
}

interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly StructuralElement[];
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
}

interface NestedClauseCandidate {
  readonly rule: ProductionRule;
  readonly random: RandomSource;
}

const CLAUSE_LIKE = new Set<SyntaxCategory>([
  "Sentence", "Clause", "OpenClause", "ClauseSequence", "RelativeClause", "ContentClause", "QuotedClause",
]);

const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };

function nextUnit(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("RandomSource.next() must return a finite value in [0, 1)");
  }
  return value;
}

function chooseIndex(random: RandomSource, size: number): number {
  return Math.min(size - 1, Math.floor(nextUnit(random) * size));
}

function shuffled<T>(values: readonly T[], random: RandomSource): readonly T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = chooseIndex(random, index + 1);
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function nestedClauseCandidateSeed(ticket: number, ruleId: string): number {
  const digest = stableRuntimeDigest({
    version: NESTED_CLAUSE_RULE_ORDER_VERSION,
    purpose: "candidate-substream",
    ticket,
    ruleId,
  });
  return Number.parseInt(digest.slice(0, 8), 16) >>> 0;
}

function nestedClauseCandidateRandom(ticket: number, ruleId: string): RandomSource {
  let state = nestedClauseCandidateSeed(ticket, ruleId);
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    },
  };
}

/**
 * Raw nested Clause sampling gets one fixed-cost random ticket per choice point.
 * Each candidate receives both a stable keyed priority and its own keyed random
 * substream. Removing an unrelated candidate therefore cannot reorder the
 * remaining candidates, and a failed candidate cannot consume random draws that
 * would otherwise alter a later candidate or the parent sampling trajectory.
 */
function stableNestedClauseCandidates(
  values: readonly ProductionRule[],
  random: RandomSource,
): readonly NestedClauseCandidate[] {
  if (values.length === 0) return [];
  const ticket = Math.floor(nextUnit(random) * 0x1_0000_0000);
  return values
    .map((rule) => ({
      rule,
      random: nestedClauseCandidateRandom(ticket, rule.id),
      priority: stableRuntimeDigest({
        version: NESTED_CLAUSE_RULE_ORDER_VERSION,
        purpose: "priority",
        ticket,
        ruleId: rule.id,
      }),
    }))
    .sort((left, right) => {
      const priorityOrder = left.priority.localeCompare(right.priority);
      return priorityOrder !== 0 ? priorityOrder : left.rule.id.localeCompare(right.rule.id);
    })
    .map(({ rule, random: candidateRandom }) => ({ rule, random: candidateRandom }));
}

function decrement(state: State, constituent: ProductionConstituent): State | null {
  if (!constituent.recursive) return state;
  if (CLAUSE_LIKE.has(constituent.category)) {
    if (state.remainingClauseDepth <= 0) return null;
    return { ...state, remainingClauseDepth: state.remainingClauseDepth - 1 };
  }
  if (state.remainingPhraseDepth <= 0) return null;
  return { ...state, remainingPhraseDepth: state.remainingPhraseDepth - 1 };
}

function bindingId(constituent: ProductionConstituent, path: readonly string[]): string | undefined {
  if (constituent.entryBinding === undefined) return undefined;
  return `${path.slice(0, -1).join("/")}:${constituent.entryBinding}`;
}

function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
): StructuralLexicalSlot {
  const entryBindingId = bindingId(constituent, path);
  const occurrenceRequirement = requirements.requiredOccurrenceCapabilities.length === 0
    ? {}
    : { requiredOccurrenceCapabilities: requirements.requiredOccurrenceCapabilities };
  const identity = {
    path,
    key: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
    ...occurrenceRequirement,
    requiredFeatures: requirements.requiredFeatures,
    entryBindingId,
    formalLiteral: constituent.formalLiteral,
  };
  return {
    kind: "lexical-slot",
    id: `syntax-slot:${stableRuntimeDigest(identity)}`,
    constituentKey: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
    ...occurrenceRequirement,
    requiredFeatures: requirements.requiredFeatures,
    ...(entryBindingId === undefined ? {} : { entryBindingId }),
    ...(constituent.formalLiteral === undefined ? {} : { formalLiteral: constituent.formalLiteral }),
  };
}

function nestedTargetKey(parentRuleId: string, constituentKey: string): string {
  return `${parentRuleId}\u0000${constituentKey}`;
}

function sampleRuleChildren(
  parentRuleId: string,
  ordered: readonly ProductionConstituent[],
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: readonly string[],
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
  rootProductionRuleId: string | undefined,
  nestedProductionTargets: ReadonlyMap<string, ValidatedNestedProductionTarget>,
  fixedCounts?: ConstituentCounts,
  deterministicCounts = false,
): SampledRuleChildren | null {
  let workingState = inputState;
  const children: StructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const rulePath: string[] = [];

  for (const constituent of ordered) {
    const maximum = effectiveConstituentMaximum(constituent, bounds);
    if (maximum < constituent.minimum) return null;
    const target = nestedProductionTargets.get(
      nestedTargetKey(parentRuleId, constituent.key),
    );
    const count = fixedCounts === undefined
      ? target?.exactCount ?? (
          deterministicCounts
            ? constituent.minimum
            : constituent.minimum + chooseIndex(random, maximum - constituent.minimum + 1)
        )
      : fixedCounts[constituent.key] ?? 0;
    if (count < constituent.minimum || count > maximum) return null;
    if (target?.exactCount !== undefined && count !== target.exactCount) return null;

    for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
      const afterDepth = decrement(workingState, constituent);
      if (afterDepth === null) return null;
      const childRequirements = requirementsForConstituent(constituent, requirements);
      if (childRequirements === null) return null;
      workingState = afterDepth;
      if (constituent.category === "Lexeme") {
        if (workingState.lexicalCount >= bounds.maximumLexicalEntriesPerUtterance) return null;
        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          [...path, constituent.key],
        );
        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        slots.push(slot);
        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
        continue;
      }
      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
        constituent.category,
        childRequirements,
        rulesByOutput,
        random,
        bounds,
        workingState,
        [...path, `${constituent.key}[${occurrenceIndex}]`],
        isLexicalSlotReachable,
        excludedClassesForConstituent(constituent),
        rootProductionRuleId,
        nestedProductionTargets,
        false,
        requestedChildRuleId,
      );
      if (child === null) return null;
      children.push(child.element);
      slots.push(...child.slots);
      rulePath.push(...child.rulePath);
      workingState = child.state;
    }
  }

  return { state: workingState, children, rulePath, slots };
}

function sampleCategory(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: readonly string[],
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
  excludedRuleClasses: ReadonlySet<ProductionRuleClass>,
  rootProductionRuleId: string | undefined,
  nestedProductionTargets: ReadonlyMap<string, ValidatedNestedProductionTarget>,
  isRoot: boolean,
  requestedProductionRuleId?: string,
): Sampled | null {
  let state = inputState;
  if (category === "Clause" || category === "OpenClause") {
    if (state.clauseCount >= bounds.maximumClausesPerSentence) return null;
    state = { ...state, clauseCount: state.clauseCount + 1 };
  }
  const eligibleRules = (rulesByOutput.get(category) ?? [])
    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))
    .filter((rule) => !isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId)
    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);
  // BAPredicate alternatives are licensing fallbacks, not a product-probability
  // dimension. Keep the reviewed path first; productive paths use a local
  // deterministic source. Nested Clause candidates independently retain #248's
  // fixed-cost keyed ordering and candidate-local substreams.
  const orderedLicensingAlternatives = category === "BAPredicate";
  const stableNestedClause = !orderedLicensingAlternatives
    && !isRoot
    && category === "Clause"
    && requestedProductionRuleId === undefined;
  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
    ? eligibleRules.map((rule) => ({
        rule,
        random: rule.id === "ba-predicate.attested" ? random : DETERMINISTIC_MINIMUM_RANDOM,
      }))
    : stableNestedClause
      ? stableNestedClauseCandidates(eligibleRules, random)
      : shuffled(eligibleRules, random).map((rule) => ({ rule, random }));
  for (const candidate of candidates) {
    const { rule } = candidate;
    const candidateRandom = candidate.random;
    const productiveBaAlternative = orderedLicensingAlternatives
      && rule.id !== "ba-predicate.attested";
    const order = orderedLicensingAlternatives && rule.surfaceOrders.length === 1
      ? rule.surfaceOrders[0]
      : rule.surfaceOrders[chooseIndex(candidateRandom, rule.surfaceOrders.length)];
    if (order === undefined) continue;
    const byKey = new Map(rule.constituents.map((item) => [item.key, item]));
    const ordered = order.constituentKeys.map((key) => byKey.get(key));
    if (ordered.some((item) => item === undefined)) continue;

    let fixedCounts: ConstituentCounts | undefined;
    if (rule.constraints.length > 0) {
      const assignments = [...validConstituentCountAssignments(rule, bounds)].filter((assignment) =>
        rule.constituents.every((constituent) => {
          const exactCount = nestedProductionTargets.get(
            nestedTargetKey(rule.id, constituent.key),
          )?.exactCount;
          return exactCount === undefined || assignment[constituent.key] === exactCount;
        }),
      );
      if (assignments.length === 0) continue;
      fixedCounts = assignments[chooseIndex(candidateRandom, assignments.length)];
    }

    const sampledChildren = sampleRuleChildren(
      rule.id,
      ordered as readonly ProductionConstituent[],
      requirements,
      rulesByOutput,
      candidateRandom,
      bounds,
      state,
      [...path, rule.id],
      isLexicalSlotReachable,
      rootProductionRuleId,
      nestedProductionTargets,
      fixedCounts,
      orderedLicensingAlternatives && !productiveBaAlternative,
    );
    if (sampledChildren === null) continue;

    const identity = {
      category,
      productionRuleId: rule.id,
      surfaceOrderId: order.id,
      children: sampledChildren.children,
    };
    const node: StructuralSyntaxNode = {
      kind: "syntax-node",
      id: `syntax-node:${stableRuntimeDigest(identity)}`,
      category,
      productionRuleId: rule.id,
      surfaceOrderId: order.id,
      children: sampledChildren.children,
    };
    return {
      element: node,
      state: sampledChildren.state,
      rulePath: [rule.id, ...sampledChildren.rulePath],
      slots: sampledChildren.slots,
    };
  }
  return null;
}

function validatedRootRuleId(options: StructuralSamplingOptions): string | undefined {
  const ruleId = options.rootProductionRuleId;
  if (ruleId === undefined) return undefined;
  const rule = options.rules.find((candidate) => candidate.id === ruleId);
  if (rule === undefined || rule.output !== options.rootCategory) {
    throw new Error(`rootProductionRuleId references non-root production: ${ruleId}`);
  }
  return ruleId;
}

function validatedNestedProductionTargets(
  options: StructuralSamplingOptions,
  bounds: DerivationBounds,
): ReadonlyMap<string, ValidatedNestedProductionTarget> {
  const rulesById = new Map(options.rules.map((rule) => [rule.id, rule]));
  const targets = new Map<string, ValidatedNestedProductionTarget>();
  for (const target of options.nestedProductionTargets ?? []) {
    const parent = rulesById.get(target.parentRuleId);
    if (parent === undefined) {
      throw new Error(`nested production target references missing parent: ${target.parentRuleId}`);
    }
    const constituent = parent.constituents.find((item) => item.key === target.constituentKey);
    if (constituent === undefined) {
      throw new Error(
        `nested production target references missing constituent: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    if (target.childRuleId === undefined && target.exactCount === undefined) {
      throw new Error(
        `nested production target requires childRuleId or exactCount: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    if (target.exactCount !== undefined) {
      const maximum = effectiveConstituentMaximum(constituent, bounds);
      if (!Number.isInteger(target.exactCount)
        || target.exactCount < constituent.minimum
        || target.exactCount > maximum) {
        throw new RangeError(
          `nested production target exactCount is outside constituent bounds: ${target.parentRuleId}:${target.constituentKey}`,
        );
      }
    }
    if (target.childRuleId !== undefined) {
      if (constituent.category === "Lexeme") {
        throw new Error(
          `nested production target cannot target lexical constituent: ${target.parentRuleId}:${target.constituentKey}`,
        );
      }
      const child = rulesById.get(target.childRuleId);
      if (child === undefined) {
        throw new Error(`nested production target references missing child: ${target.childRuleId}`);
      }
      if (child.output !== constituent.category) {
        throw new Error(
          `nested production target child category mismatch: ${target.parentRuleId}:${target.constituentKey} -> ${target.childRuleId}`,
        );
      }
    }
    const key = nestedTargetKey(target.parentRuleId, target.constituentKey);
    if (targets.has(key)) {
      throw new Error(
        `nested production target duplicates parent constituent: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    targets.set(key, {
      ...(target.childRuleId === undefined ? {} : { childRuleId: target.childRuleId }),
      ...(target.exactCount === undefined ? {} : { exactCount: target.exactCount }),
    });
  }
  return targets;
}

export function sampleStructuralDerivation(
  options: StructuralSamplingOptions,
): StructuralDerivationShape | null {
  const bounds = options.bounds ?? DEFAULT_DERIVATION_BOUNDS;
  const maximumAttempts = options.maximumAttempts ?? 16;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts <= 0) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  assertValidGrammar(options.rules, bounds);
  const requestedRootRuleId = validatedRootRuleId(options);
  const nestedProductionTargets = validatedNestedProductionTargets(options, bounds);
  const rulesByOutput = new Map<SyntaxCategory, readonly ProductionRule[]>();
  for (const rule of options.rules) {
    rulesByOutput.set(rule.output, [...(rulesByOutput.get(rule.output) ?? []), rule]);
  }
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const sampled = sampleCategory(
      options.rootCategory,
      EMPTY_SYNTAX_REQUIREMENTS,
      rulesByOutput,
      options.random,
      bounds,
      {
        remainingPhraseDepth: bounds.maximumPhraseDepth,
        remainingClauseDepth: bounds.maximumClauseNesting,
        clauseCount: 0,
        lexicalCount: 0,
      },
      [options.rootCategory],
      options.isLexicalSlotReachable,
      new Set(),
      requestedRootRuleId,
      nestedProductionTargets,
      true,
    );
    if (sampled === null || sampled.element.kind !== "syntax-node") continue;
    const identity = {
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      root: sampled.element,
      productionRulePath: sampled.rulePath,
    };
    return {
      id: `derivation-shape:${stableRuntimeDigest(identity)}`,
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      root: sampled.element,
      productionRulePath: sampled.rulePath,
      lexicalSlots: sampled.slots,
      clauseCount: sampled.state.clauseCount,
      lexicalSlotCount: sampled.state.lexicalCount,
    };
  }
  return null;
}
