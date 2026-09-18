import type { RandomSource } from "../core/model.js";
import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestSourceFirstUint32FromPrefixState,
  stableRuntimeDigestSourceFirstUint32PrefixState,
} from "../core/stable-id.js";
import {
  effectiveConstituentMaximum,
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
import { prepareStaticCompatibilityCacheKey } from "./realize.js";
import type {
  DerivationBounds,
  ProductionConstituent,
  ProductionRule,
  ProductionRuleClass,
  RuntimeOccurrenceCapability,
  SyntacticFunction,
  SurfaceOrder,
  SyntaxCategory,
  SyntaxFeatureName,
  SyntaxFeatureSet,
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

export interface RequiredLexicalSlotConstraint {
  /** Feature requirements carried by the lexical slot itself. */
  readonly requiredFeatures?: SyntaxFeatureSet;
  /** Reviewed occurrence-capability requirements carried by the lexical slot itself. */
  readonly requiredOccurrenceCapabilities?: readonly RuntimeOccurrenceCapability[];
  /** Requirements carried by the syntax category that directly contains the slot. */
  readonly enclosingRequiredFunctions?: readonly SyntacticFunction[];
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
  /**
   * Require the sampled production path to contain at least one named rule.
   * This is useful when several alternative parents share one orthogonal practice axis.
   */
  readonly requiredProductionRuleIdsAnyOf?: readonly string[];
  /**
   * Require at least one realized lexical slot matching both lexical requirements
   * and requirements on its immediately enclosing syntax category. Enclosing
   * requirements are sampler-only metadata and do not alter derivation identity.
   */
  readonly requiredLexicalSlot?: RequiredLexicalSlotConstraint;
}

interface State {
  readonly remainingPhraseDepth: number;
  readonly remainingClauseDepth: number;
  readonly clauseCount: number;
  readonly lexicalCount: number;
}

interface SampledLexicalSlotContext {
  readonly slot: StructuralLexicalSlot;
  readonly enclosingRequiredFunctions: readonly SyntacticFunction[];
}

interface PendingSyntaxNode {
  readonly kind: "syntax-node";
  readonly category: SyntaxCategory;
  readonly productionRuleId: string;
  readonly surfaceOrderId: string;
  readonly children: readonly PendingStructuralElement[];
}

type PendingStructuralElement = StructuralLexicalSlot | PendingSyntaxNode;

interface Sampled {
  readonly element: PendingStructuralElement;
  readonly state: State;
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}

interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly PendingStructuralElement[];
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}

interface NestedClauseCandidate {
  readonly rule: ProductionRule;
  readonly random: RandomSource;
}

const CLAUSE_LIKE = new Set<SyntaxCategory>([
  "Sentence", "Clause", "OpenClause", "ClauseSequence", "RelativeClause", "ContentClause", "QuotedClause",
]);

const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };
const NO_EXCLUDED_RULE_CLASSES = new Set<ProductionRuleClass>();
const COORDINATION_EXCLUDED_RULE_CLASSES = new Set<ProductionRuleClass>(["coordination"]);

interface PreparedEligibleRuleSets {
  readonly defaultByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>;
  readonly withoutCoordinationByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>;
}

const preparedEligibleRuleSetsByContext = new WeakMap<
  PreparedStructuralSamplingContext,
  PreparedEligibleRuleSets
>();

function prepareEligibleRuleSets(
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  bounds: DerivationBounds,
): PreparedEligibleRuleSets {
  const defaultByOutput = new Map<SyntaxCategory, readonly ProductionRule[]>();
  const withoutCoordinationByOutput = new Map<SyntaxCategory, readonly ProductionRule[]>();
  for (const [category, rules] of rulesByOutput) {
    defaultByOutput.set(
      category,
      rules.filter((rule) =>
        ruleAllowedByDerivationBounds(rule, bounds, NO_EXCLUDED_RULE_CLASSES)
      ),
    );
    withoutCoordinationByOutput.set(
      category,
      rules.filter((rule) =>
        ruleAllowedByDerivationBounds(rule, bounds, COORDINATION_EXCLUDED_RULE_CLASSES)
      ),
    );
  }
  return { defaultByOutput, withoutCoordinationByOutput };
}

function samplingRuleClassMask(
  constituent: ProductionConstituent,
): number {
  let mask = 0;
  for (const ruleClass of constituent.excludedRuleClasses ?? []) {
    switch (ruleClass) {
      case "coordination":
        mask |= 1;
        break;
      default: {
        const unsupported: never = ruleClass;
        throw new Error(`unsupported production rule class: ${String(unsupported)}`);
      }
    }
  }
  return mask;
}

function canonicalFeatureSetJson(features: SyntaxFeatureSet): string {
  const fields = Object.keys(features)
    .filter((key) => features[key as SyntaxFeatureName] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(features[key as SyntaxFeatureName])}`);
  return `{${fields.join(",")}}`;
}

function canonicalStringArrayJson(values: readonly string[]): string {
  return JSON.stringify(values);
}

function lexicalSlotIdentityCanonicalJson(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
  entryBindingId: string | undefined,
): string {
  const fields = [
    `"allowedUpos":${canonicalStringArrayJson(constituent.allowedUpos)}`,
    ...(entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(entryBindingId)}`]),
    ...(constituent.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(constituent.formalLiteral)}`]),
    `"key":${JSON.stringify(constituent.key)}`,
    `"occurrenceIndex":${occurrenceIndex}`,
    `"path":${canonicalStringArrayJson(path)}`,
    `"requiredFeatures":${canonicalFeatureSetJson(requirements.requiredFeatures)}`,
    `"requiredFunctions":${canonicalStringArrayJson(requirements.requiredFunctions)}`,
    ...(requirements.requiredOccurrenceCapabilities.length === 0
      ? []
      : [`"requiredOccurrenceCapabilities":${canonicalStringArrayJson(requirements.requiredOccurrenceCapabilities)}`]),
    `"requiredValencyFrames":${canonicalStringArrayJson(requirements.requiredValencyFrames)}`,
  ];
  return `{${fields.join(",")}}`;
}

function lexicalSlotCanonicalJson(slot: StructuralLexicalSlot): string {
  const fields = [
    `"allowedUpos":${canonicalStringArrayJson(slot.allowedUpos)}`,
    `"constituentKey":${JSON.stringify(slot.constituentKey)}`,
    ...(slot.entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(slot.entryBindingId)}`]),
    ...(slot.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(slot.formalLiteral)}`]),
    `"id":${JSON.stringify(slot.id)}`,
    `"kind":"lexical-slot"`,
    `"occurrenceIndex":${slot.occurrenceIndex}`,
    `"requiredFeatures":${canonicalFeatureSetJson(slot.requiredFeatures)}`,
    `"requiredFunctions":${canonicalStringArrayJson(slot.requiredFunctions)}`,
    ...(slot.requiredOccurrenceCapabilities === undefined
      ? []
      : [`"requiredOccurrenceCapabilities":${canonicalStringArrayJson(slot.requiredOccurrenceCapabilities)}`]),
    `"requiredValencyFrames":${canonicalStringArrayJson(slot.requiredValencyFrames)}`,
  ];
  return `{${fields.join(",")}}`;
}

function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {
  return `[${childCanonicalSources.join(",")}]`;
}

function syntaxNodeIdentityCanonicalJson(
  category: SyntaxCategory,
  productionRuleId: string,
  surfaceOrderId: string,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(category)},"children":${childrenCanonicalJson(childCanonicalSources)},"productionRuleId":${JSON.stringify(productionRuleId)},"surfaceOrderId":${JSON.stringify(surfaceOrderId)}}`;
}

function syntaxNodeCanonicalJson(
  node: StructuralSyntaxNode,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalJson(childCanonicalSources)},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;
}

interface MaterializedPendingElement {
  readonly element: StructuralElement;
  readonly canonicalSource: string;
}

function materializePendingElement(
  pending: PendingStructuralElement,
): MaterializedPendingElement {
  if (pending.kind === "lexical-slot") {
    return { element: pending, canonicalSource: lexicalSlotCanonicalJson(pending) };
  }
  const materializedChildren = pending.children.map(materializePendingElement);
  const childCanonicalSources = materializedChildren.map((child) => child.canonicalSource);
  const identitySource = syntaxNodeIdentityCanonicalJson(
    pending.category,
    pending.productionRuleId,
    pending.surfaceOrderId,
    childCanonicalSources,
  );
  const node: StructuralSyntaxNode = {
    kind: "syntax-node",
    id: `syntax-node:${stableRuntimeDigestCanonicalJson(identitySource)}`,
    category: pending.category,
    productionRuleId: pending.productionRuleId,
    surfaceOrderId: pending.surfaceOrderId,
    children: materializedChildren.map((child) => child.element),
  };
  return {
    element: node,
    canonicalSource: syntaxNodeCanonicalJson(node, childCanonicalSources),
  };
}

function derivationIdentityCanonicalJson(
  rootCanonicalSource: string,
  productionRulePath: readonly string[],
): string {
  return `{"grammarVersion":${JSON.stringify(FORMAL_GRAMMAR_VERSION)},"productionRulePath":${canonicalStringArrayJson(productionRulePath)},"root":${rootCanonicalSource}}`;
}

/** Static grammar preparation reusable while the exact rules and bounds stay unchanged. */
export interface PreparedStructuralSamplingContext {
  readonly rules: readonly ProductionRule[];
  readonly bounds: DerivationBounds;
  readonly rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>;
  readonly orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>;
}

export function prepareStructuralSamplingContext(
  rules: readonly ProductionRule[],
  bounds: DerivationBounds = DEFAULT_DERIVATION_BOUNDS,
): PreparedStructuralSamplingContext {
  assertValidGrammar(rules, bounds);
  const rulesByOutput = new Map<SyntaxCategory, readonly ProductionRule[]>();
  const orderedConstituentsBySurfaceOrder = new Map<SurfaceOrder, readonly ProductionConstituent[]>();
  for (const rule of rules) {
    rulesByOutput.set(rule.output, [...(rulesByOutput.get(rule.output) ?? []), rule]);
    const byKey = new Map(rule.constituents.map((item) => [item.key, item]));
    for (const order of rule.surfaceOrders) {
      const ordered = order.constituentKeys.map((key) => byKey.get(key));
      if (ordered.some((item) => item === undefined)) {
        throw new Error(`surface order references missing constituent after validation: ${rule.id}:${order.id}`);
      }
      orderedConstituentsBySurfaceOrder.set(
        order,
        ordered as readonly ProductionConstituent[],
      );
    }
  }
  const context = { rules, bounds, rulesByOutput, orderedConstituentsBySurfaceOrder };
  preparedEligibleRuleSetsByContext.set(
    context,
    prepareEligibleRuleSets(rulesByOutput, bounds),
  );
  return context;
}

function eligibleRuleSetsForContext(
  context: PreparedStructuralSamplingContext,
  bounds: DerivationBounds,
): PreparedEligibleRuleSets {
  const cached = preparedEligibleRuleSetsByContext.get(context);
  if (cached !== undefined) return cached;
  const prepared = prepareEligibleRuleSets(context.rulesByOutput, bounds);
  preparedEligibleRuleSetsByContext.set(context, prepared);
  return prepared;
}

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

function nestedClauseKeyedCanonicalJson(
  purpose: "candidate-substream" | "priority",
  ticket: number,
  ruleId: string,
): string {
  // These keys are already in stableRuntimeDigest canonical sort order:
  // purpose, ruleId, ticket, version. Keep this byte-for-byte equivalent.
  return JSON.stringify({
    purpose,
    ruleId,
    ticket,
    version: NESTED_CLAUSE_RULE_ORDER_VERSION,
  });
}

const NESTED_CLAUSE_CANONICAL_SUFFIX = `,"version":${JSON.stringify(
  NESTED_CLAUSE_RULE_ORDER_VERSION,
)}}`;

interface NestedClauseHashPrefixStates {
  readonly candidateSubstream: number;
  readonly priority: number;
}

const NESTED_CLAUSE_HASH_PREFIX_CACHE = new WeakMap<ProductionRule, NestedClauseHashPrefixStates>();

function nestedClauseHashPrefixStates(rule: ProductionRule): NestedClauseHashPrefixStates {
  const cached = NESTED_CLAUSE_HASH_PREFIX_CACHE.get(rule);
  if (cached !== undefined) return cached;
  const ruleIdCanonicalJson = JSON.stringify(rule.id);
  const created = {
    candidateSubstream: stableRuntimeDigestSourceFirstUint32PrefixState(
      `{"purpose":"candidate-substream","ruleId":${ruleIdCanonicalJson},"ticket":`,
    ),
    priority: stableRuntimeDigestSourceFirstUint32PrefixState(
      `{"purpose":"priority","ruleId":${ruleIdCanonicalJson},"ticket":`,
    ),
  };
  NESTED_CLAUSE_HASH_PREFIX_CACHE.set(rule, created);
  return created;
}

function nestedClauseKeyedFirstUint32(prefixState: number, ticket: number): number {
  return stableRuntimeDigestSourceFirstUint32FromPrefixState(
    prefixState,
    String(ticket),
    NESTED_CLAUSE_CANONICAL_SUFFIX,
  );
}

function nestedClauseCandidateRandom(seed: number): RandomSource {
  let state = seed;
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
    .map((rule) => {
      const prefixes = nestedClauseHashPrefixStates(rule);
      return {
        rule,
        random: nestedClauseCandidateRandom(
          nestedClauseKeyedFirstUint32(prefixes.candidateSubstream, ticket),
        ),
        priorityFirstUint32: nestedClauseKeyedFirstUint32(prefixes.priority, ticket),
      };
    })
    .sort((left, right) => {
      if (left.priorityFirstUint32 !== right.priorityFirstUint32) {
        return left.priorityFirstUint32 < right.priorityFirstUint32 ? -1 : 1;
      }
      const priorityOrder = stableRuntimeDigestCanonicalJson(
        nestedClauseKeyedCanonicalJson("priority", ticket, left.rule.id),
      ).localeCompare(stableRuntimeDigestCanonicalJson(
        nestedClauseKeyedCanonicalJson("priority", ticket, right.rule.id),
      ));
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

interface SamplingPathNode {
  readonly parent: SamplingPathNode | null;
  readonly segment: string;
}

function extendSamplingPath(
  parent: SamplingPathNode | null,
  segment: string,
): SamplingPathNode {
  return { parent, segment };
}

function materializeSamplingPath(path: SamplingPathNode): readonly string[] {
  const segments: string[] = [];
  for (let current: SamplingPathNode | null = path; current !== null; current = current.parent) {
    segments.push(current.segment);
  }
  segments.reverse();
  return segments;
}

function bindingId(constituent: ProductionConstituent, path: SamplingPathNode): string | undefined {
  if (constituent.entryBinding === undefined) return undefined;
  const parentPath = path.parent;
  return `${parentPath === null ? "" : materializeSamplingPath(parentPath).join("/")}:${constituent.entryBinding}`;
}

function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: SamplingPathNode,
): StructuralLexicalSlot {
  const entryBindingId = bindingId(constituent, path);
  const occurrenceRequirement = requirements.requiredOccurrenceCapabilities.length === 0
    ? {}
    : { requiredOccurrenceCapabilities: requirements.requiredOccurrenceCapabilities };
  let cachedId: string | undefined;
  return {
    kind: "lexical-slot",
    get id() {
      cachedId ??= `syntax-slot:${stableRuntimeDigestCanonicalJson(lexicalSlotIdentityCanonicalJson(
        constituent,
        requirements,
        occurrenceIndex,
        materializeSamplingPath(path),
        entryBindingId,
      ))}`;
      return cachedId;
    },
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

function hasDynamicInheritedContribution(
  constituent: ProductionConstituent,
  parent: SyntaxRequirements,
): boolean {
  if (constituent.inheritFunctions === true && parent.requiredFunctions.length > 0) return true;
  if (constituent.inheritValencyFrames === true && parent.requiredValencyFrames.length > 0) return true;
  if (constituent.inheritOccurrenceCapabilities === true
    && parent.requiredOccurrenceCapabilities.length > 0) return true;
  return constituent.inheritFeatures === true && Object.keys(parent.requiredFeatures).length > 0;
}

function sampleRuleChildren(
  parentRuleId: string,
  ordered: readonly ProductionConstituent[],
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  eligibleRuleSets: PreparedEligibleRuleSets,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: SamplingPathNode,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
  rootProductionRuleId: string | undefined,
  nestedProductionTargets: ReadonlyMap<string, ValidatedNestedProductionTarget>,
  fixedCounts?: ConstituentCounts,
  deterministicCounts = false,
): SampledRuleChildren | null {
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
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
          extendSamplingPath(path, constituent.key),
        );
        if (!hasDynamicInheritedContribution(constituent, requirements)) {
          prepareStaticCompatibilityCacheKey(slot, constituent);
        }
        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        slots.push(slot);
        slotContexts.push({
          slot,
          enclosingRequiredFunctions: requirements.requiredFunctions,
        });
        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
        continue;
      }
      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
        constituent.category,
        childRequirements,
        rulesByOutput,
        orderedConstituentsBySurfaceOrder,
        eligibleRuleSets,
        random,
        bounds,
        workingState,
        extendSamplingPath(path, `${constituent.key}[${occurrenceIndex}]`),
        isLexicalSlotReachable,
        samplingRuleClassMask(constituent),
        rootProductionRuleId,
        nestedProductionTargets,
        false,
        requestedChildRuleId,
      );
      if (child === null) return null;
      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      rulePath.push(...child.rulePath);
      workingState = child.state;
    }
  }

  return {
    state: workingState,
    children,
    rulePath,
    slots,
    slotContexts,
  };
}

function sampleCategory(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  eligibleRuleSets: PreparedEligibleRuleSets,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: SamplingPathNode,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
  excludedRuleClassMask: number,
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
  let eligibleRules = (
    excludedRuleClassMask === 0
      ? eligibleRuleSets.defaultByOutput
      : eligibleRuleSets.withoutCoordinationByOutput
  ).get(category) ?? [];
  if (isRoot && rootProductionRuleId !== undefined) {
    eligibleRules = eligibleRules.filter((rule) => rule.id === rootProductionRuleId);
  }
  if (requestedProductionRuleId !== undefined) {
    eligibleRules = eligibleRules.filter((rule) => rule.id === requestedProductionRuleId);
  }
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
    const ordered = orderedConstituentsBySurfaceOrder.get(order);
    if (ordered === undefined) {
      throw new Error(`missing prepared surface order: ${rule.id}:${order.id}`);
    }

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
      orderedConstituentsBySurfaceOrder,
      eligibleRuleSets,
      candidateRandom,
      bounds,
      state,
      extendSamplingPath(path, rule.id),
      isLexicalSlotReachable,
      rootProductionRuleId,
      nestedProductionTargets,
      fixedCounts,
      orderedLicensingAlternatives && !productiveBaAlternative,
    );
    if (sampledChildren === null) continue;

    const node: PendingSyntaxNode = {
      kind: "syntax-node",
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
      slotContexts: sampledChildren.slotContexts,
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

function validatedRequiredProductionRuleIdsAnyOf(
  options: StructuralSamplingOptions,
): readonly string[] | undefined {
  const requested = options.requiredProductionRuleIdsAnyOf;
  if (requested === undefined) return undefined;
  if (requested.length === 0) {
    throw new Error("requiredProductionRuleIdsAnyOf requires at least one production rule");
  }
  const unique = [...new Set(requested)];
  if (unique.length != requested.length) {
    throw new Error("requiredProductionRuleIdsAnyOf contains duplicate production rules");
  }
  const known = new Set(options.rules.map((rule) => rule.id));
  const missing = unique.filter((ruleId) => !known.has(ruleId));
  if (missing.length > 0) {
    throw new Error(`requiredProductionRuleIdsAnyOf references missing productions: ${missing.join(", ")}`);
  }
  return unique;
}

function lexicalSlotMatchesConstraint(
  context: SampledLexicalSlotContext,
  required: RequiredLexicalSlotConstraint,
): boolean {
  const requiredFeatures = required.requiredFeatures ?? {};
  const featuresMatch = (Object.keys(requiredFeatures) as SyntaxFeatureName[]).every((feature) =>
    context.slot.requiredFeatures[feature] === requiredFeatures[feature],
  );
  if (!featuresMatch) return false;
  const requiredOccurrenceCapabilities = required.requiredOccurrenceCapabilities ?? [];
  const slotOccurrenceCapabilities = context.slot.requiredOccurrenceCapabilities ?? [];
  if (!requiredOccurrenceCapabilities.every((capability) =>
    slotOccurrenceCapabilities.includes(capability),
  )) return false;
  const requiredFunctions = required.enclosingRequiredFunctions ?? [];
  return requiredFunctions.every((requiredFunction) =>
    context.enclosingRequiredFunctions.includes(requiredFunction),
  );
}

export function sampleStructuralDerivation(
  options: StructuralSamplingOptions,
  preparedContext?: PreparedStructuralSamplingContext,
): StructuralDerivationShape | null {
  const bounds = options.bounds ?? DEFAULT_DERIVATION_BOUNDS;
  const maximumAttempts = options.maximumAttempts ?? 16;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts <= 0) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  const context = preparedContext ?? prepareStructuralSamplingContext(options.rules, bounds);
  if (context.rules !== options.rules || context.bounds !== bounds) {
    throw new Error("prepared structural sampling context input identity mismatch");
  }
  const requestedRootRuleId = validatedRootRuleId(options);
  const nestedProductionTargets = validatedNestedProductionTargets(options, bounds);
  const requiredProductionRuleIdsAnyOf = validatedRequiredProductionRuleIdsAnyOf(options);
  const rulesByOutput = context.rulesByOutput;
  const orderedConstituentsBySurfaceOrder = context.orderedConstituentsBySurfaceOrder;
  const eligibleRuleSets = eligibleRuleSetsForContext(context, bounds);
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const sampled = sampleCategory(
      options.rootCategory,
      EMPTY_SYNTAX_REQUIREMENTS,
      rulesByOutput,
      orderedConstituentsBySurfaceOrder,
      eligibleRuleSets,
      options.random,
      bounds,
      {
        remainingPhraseDepth: bounds.maximumPhraseDepth,
        remainingClauseDepth: bounds.maximumClauseNesting,
        clauseCount: 0,
        lexicalCount: 0,
      },
      extendSamplingPath(null, options.rootCategory),
      options.isLexicalSlotReachable,
      0,
      requestedRootRuleId,
      nestedProductionTargets,
      true,
    );
    if (sampled === null || sampled.element.kind !== "syntax-node") continue;
    const requiredLexicalSlot = options.requiredLexicalSlot;
    if (requiredLexicalSlot !== undefined
      && !sampled.slotContexts.some((context) =>
        lexicalSlotMatchesConstraint(context, requiredLexicalSlot),
      )) continue;
    if (requiredProductionRuleIdsAnyOf !== undefined
      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) continue;
    const materializedRoot = materializePendingElement(sampled.element);
    if (materializedRoot.element.kind !== "syntax-node") {
      throw new Error("sampled root materialized as non-syntax node");
    }
    const identitySource = derivationIdentityCanonicalJson(
      materializedRoot.canonicalSource,
      sampled.rulePath,
    );
    return {
      id: `derivation-shape:${stableRuntimeDigestCanonicalJson(identitySource)}`,
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      root: materializedRoot.element,
      productionRulePath: sampled.rulePath,
      lexicalSlots: sampled.slots,
      clauseCount: sampled.state.clauseCount,
      lexicalSlotCount: sampled.state.lexicalCount,
    };
  }
  return null;
}
