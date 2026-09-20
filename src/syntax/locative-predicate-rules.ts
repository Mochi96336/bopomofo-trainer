import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";
import type {
  ConstituentCardinalityBound,
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  RuntimeOccurrenceCapability,
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
  readonly requiredOccurrenceCapabilities?: readonly RuntimeOccurrenceCapability[];
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
    ...(options.requiredOccurrenceCapabilities === undefined
      ? {}
      : { requiredOccurrenceCapabilities: options.requiredOccurrenceCapabilities }),
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
    output: "LocativePredicate",
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
 * Construction-specific verbal locative predicate boundary.
 *
 * Pinned Chinese GSD supports reviewed 在/VERB root + subject + object
 * predication, but does not provide affirmative same-predicate aspect evidence:
 * the sole direct 了 child in the reviewed frontier is annotated as discourse,
 * with no Aspect feature, and 過/著 are unattested there.
 *
 * Keep predicate-internal negation/modal/adverbial/complement structure
 * available, while deliberately omitting the generic postverbal aspect slot.
 * The enclosing Clause owns transitive + reviewed locative requirements and
 * these rules inherit them onto the lexical VERB head.
 */
export const LOCATIVE_PREDICATE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("locative-predicate.lexical", [
    lexical("head", ["VERB"], {
      inheritValencyFrames: true,
      inheritOccurrenceCapabilities: true,
      inheritFeatures: true,
    }),
  ]),
  production("locative-predicate.expanded", [
    lexical("negation", ["ADV", "AUX", "PART", "VERB"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { polarity: "negative" },
    }),
    lexical("modal", ["AUX"], {
      minimum: 0,
      maximum: 2,
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    }),
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
  ]),
];

export const LOCATIVE_PREDICATE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  LOCATIVE_PREDICATE_PRODUCTION_RULES.flatMap(fixturesForRule);
