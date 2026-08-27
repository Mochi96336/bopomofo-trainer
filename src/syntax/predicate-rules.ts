import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ConstituentCardinalityBound,
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  SyntacticFunction,
  SyntaxCategory,
  SyntaxFeatureSet,
  Upos,
  ValencyFrame,
} from "./types.js";

interface ConstituentOptions {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly recursive?: boolean;
  readonly allowedUpos?: readonly Upos[];
  readonly requiredFunctions?: readonly SyntacticFunction[];
  readonly requiredValencyFrames?: readonly ValencyFrame[];
  readonly requiredFeatures?: SyntaxFeatureSet;
  readonly inheritFunctions?: boolean;
  readonly inheritValencyFrames?: boolean;
  readonly inheritOccurrenceCapabilities?: boolean;
  readonly inheritFeatures?: boolean;
  readonly cardinalityBound?: ConstituentCardinalityBound;
}

function constituent(
  key: string,
  category: SyntaxCategory,
  options: ConstituentOptions = {},
): ProductionConstituent {
  return {
    key,
    category,
    minimum: options.minimum ?? 1,
    maximum: options.maximum ?? 1,
    recursive: options.recursive ?? false,
    allowedUpos: options.allowedUpos ?? [],
    requiredFunctions: options.requiredFunctions ?? [],
    requiredValencyFrames: options.requiredValencyFrames ?? [],
    requiredFeatures: options.requiredFeatures ?? {},
    ...(options.inheritFunctions ? { inheritFunctions: true } : {}),
    ...(options.inheritValencyFrames ? { inheritValencyFrames: true } : {}),
    ...(options.inheritOccurrenceCapabilities ? { inheritOccurrenceCapabilities: true } : {}),
    ...(options.inheritFeatures ? { inheritFeatures: true } : {}),
    ...(options.cardinalityBound === undefined ? {} : { cardinalityBound: options.cardinalityBound }),
  };
}

function lexical(
  key: string,
  allowedUpos: readonly Upos[],
  options: Omit<ConstituentOptions, "allowedUpos"> = {},
): ProductionConstituent {
  return constituent(key, "Lexeme", { ...options, allowedUpos });
}

function production(
  id: string,
  constituents: readonly ProductionConstituent[],
): ProductionRule {
  const variable = constituents.some((item) => item.minimum !== item.maximum);
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Predicate",
    constituents,
    surfaceOrders: [{ id: "canonical", constituentKeys: constituents.map((item) => item.key) }],
    constraints: [],
    positiveFixtureIds: variable ? [`${id}:minimum`, `${id}:maximum`] : [`${id}:minimum`],
    negativeFixtureIds: [`${id}:overflow`],
  };
}

function countsFor(
  rule: ProductionRule,
  selection: "minimum" | "maximum",
): Readonly<Record<string, number>> {
  return Object.fromEntries(rule.constituents.map((item) => [
    item.key,
    selection === "minimum" ? item.minimum : item.maximum,
  ]));
}

function fixturesForRule(rule: ProductionRule): readonly ProductionFixture[] {
  const order = rule.surfaceOrders[0];
  const first = rule.constituents[0];
  if (order === undefined || first === undefined) {
    throw new Error(`formal production ${rule.id} requires an order and constituent`);
  }
  const result: ProductionFixture[] = [{
    id: `${rule.id}:minimum`,
    ruleId: rule.id,
    expected: "accept",
    surfaceOrderId: order.id,
    constituentCounts: countsFor(rule, "minimum"),
  }];
  if (rule.positiveFixtureIds.includes(`${rule.id}:maximum`)) {
    result.push({
      id: `${rule.id}:maximum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: order.id,
      constituentCounts: countsFor(rule, "maximum"),
    });
  }
  result.push({
    id: `${rule.id}:overflow`,
    ruleId: rule.id,
    expected: "reject",
    surfaceOrderId: order.id,
    constituentCounts: { ...countsFor(rule, "minimum"), [first.key]: first.maximum + 1 },
  });
  return result;
}

/**
 * Transitional object-free predicate core for Clause-model v2 migration.
 *
 * Clause/argument constructions that already own their arguments use this
 * category so a nested VerbPhrase cannot silently add another object. Legacy
 * VerbPhrase remains executable for callers that have not migrated yet.
 *
 * Predicate heads inherit lexical valency, same-occurrence capability, and
 * feature requirements but deliberately do not inherit the enclosing structural
 * `predicate` function. In the current UD projection that function is evidence
 * that this written form was observed as `root`; it is not a complete lexical-
 * capability inventory. Marking and complement constituents intentionally remain
 * here for behavior parity until their own v2 axes become executable.
 */
export const PREDICATE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("predicate.verb.lexical", [
    lexical("head", ["VERB"], {
      inheritValencyFrames: true,
      inheritOccurrenceCapabilities: true,
      inheritFeatures: true,
    }),
  ]),
  production("predicate.verb.expanded", [
    lexical("negation", ["ADV", "AUX", "PART", "VERB"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { polarity: "negative" },
    }),
    lexical("modal", ["AUX"], { minimum: 0, maximum: 2 }),
    constituent("adverbial", "AdverbPhrase", {
      minimum: 0,
      maximum: 3,
      cardinalityBound: "consecutive-modifiers",
    }),
    lexical("head", ["VERB"], {
      inheritValencyFrames: true,
      inheritOccurrenceCapabilities: true,
      inheritFeatures: true,
    }),
    constituent("complement", "Complement", {
      minimum: 0,
      maximum: 2,
      cardinalityBound: "complements-per-predicate",
    }),
    lexical("aspect", ["AUX", "PART"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { aspect: "marked" },
    }),
  ]),
];

export const PREDICATE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  PREDICATE_PRODUCTION_RULES.flatMap(fixturesForRule);
