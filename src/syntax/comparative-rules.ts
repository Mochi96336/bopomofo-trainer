import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import { VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";
import type {
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
  };
}

function production(
  id: string,
  output: "ComparativeStandard" | "ComparativePredicate",
  constituents: readonly ProductionConstituent[],
): ProductionRule {
  const variable = constituents.some((item) => item.minimum !== item.maximum);
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
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
 * Comparative argument roles are structural, not lexical corpus-role gates.
 *
 * The reviewed 比/ADP(case) source frontier overwhelmingly realizes the
 * comparison standard with nmod rather than obl. The wrapper therefore owns
 * the comparative-standard role while its NounPhrase remains open-class.
 */
export const COMPARATIVE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("comparative-standard.nominal", "ComparativeStandard", [
    constituent("phrase", "NounPhrase"),
  ]),
  production("comparative-predicate.adjectival", "ComparativePredicate", [
    constituent("predicate", "AdjectivePhrase", {
      inheritFunctions: true,
    }),
  ]),
  production("comparative-predicate.verbal", "ComparativePredicate", [
    constituent("predicate", "Predicate", {
      requiredOccurrenceCapabilities: [
        VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY,
      ],
      inheritFunctions: true,
    }),
  ]),
];

export const COMPARATIVE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  COMPARATIVE_PRODUCTION_RULES.flatMap(fixturesForRule);
