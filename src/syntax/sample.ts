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

const CLAUSE_LIKE = new Set<SyntaxCategory>([
  "Sentence", "Clause", "OpenClause", "ClauseSequence", "RelativeClause", "ContentClause", "QuotedClause",
]);

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

function sampleRuleChildren(
  ordered: readonly ProductionConstituent[],
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: readonly string[],
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
  rootProductionRuleId: string | undefined,
  fixedCounts?: ConstituentCounts,
): SampledRuleChildren | null {
  let workingState = inputState;
  const children: StructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const rulePath: string[] = [];

  for (const constituent of ordered) {
    const maximum = effectiveConstituentMaximum(constituent, bounds);
    if (maximum < constituent.minimum) return null;
    const count = fixedCounts === undefined
      ? constituent.minimum + chooseIndex(random, maximum - constituent.minimum + 1)
      : fixedCounts[constituent.key] ?? 0;
    if (count < constituent.minimum || count > maximum) return null;

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
        false,
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
  isRoot: boolean,
): Sampled | null {
  let state = inputState;
  if (category === "Clause" || category === "OpenClause") {
    if (state.clauseCount >= bounds.maximumClausesPerSentence) return null;
    state = { ...state, clauseCount: state.clauseCount + 1 };
  }
  const eligibleRules = (rulesByOutput.get(category) ?? [])
    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))
    .filter((rule) => !isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId);
  const candidates = shuffled(eligibleRules, random);
  for (const rule of candidates) {
    const order = rule.surfaceOrders[chooseIndex(random, rule.surfaceOrders.length)];
    if (order === undefined) continue;
    const byKey = new Map(rule.constituents.map((item) => [item.key, item]));
    const ordered = order.constituentKeys.map((key) => byKey.get(key));
    if (ordered.some((item) => item === undefined)) continue;

    let fixedCounts: ConstituentCounts | undefined;
    if (rule.constraints.length > 0) {
      const assignments = [...validConstituentCountAssignments(rule, bounds)];
      if (assignments.length === 0) continue;
      fixedCounts = assignments[chooseIndex(random, assignments.length)];
    }

    const sampledChildren = sampleRuleChildren(
      ordered as readonly ProductionConstituent[],
      requirements,
      rulesByOutput,
      random,
      bounds,
      state,
      [...path, rule.id],
      isLexicalSlotReachable,
      rootProductionRuleId,
      fixedCounts,
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
