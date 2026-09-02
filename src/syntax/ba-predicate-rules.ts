import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import { BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";
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
  readonly cardinalityBound?: ConstituentCardinalityBound;
}

const PATIENT_TAKING_FRAMES = [
  "transitive",
  "ditransitive",
  "ambitransitive",
] as const satisfies readonly ValencyFrame[];

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
    ...(options.cardinalityBound === undefined
      ? {}
      : { cardinalityBound: options.cardinalityBound }),
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
    output: "BAPredicate",
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

function optionalPrefix(): readonly ProductionConstituent[] {
  return [
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
  ];
}

function patientTakingHead(): ProductionConstituent {
  return lexical("head", ["VERB"], { requiredValencyFrames: PATIENT_TAKING_FRAMES });
}

/**
 * BA owns a distinct predicate-structure boundary instead of turning corpus
 * attestation into the whole productive grammar.
 *
 * `BAPredicate` is a licensing disjunction, not a product sampling dimension.
 * The structural sampler therefore tries these rules in declaration order:
 * productive completed paths first, then the reviewed direct-attestation
 * backstop. Corpus non-attestation is never negative evidence.
 *
 * The backstop is intentionally a direct VERB slot rather than another
 * `Predicate` subtree. Its purpose is to license lexicalized/bare BA predicates
 * whose completion is not represented by the current tokenizer/grammar; it must
 * not reopen optional generic Predicate structure after the productive paths
 * have failed.
 */
export const BA_PREDICATE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("ba-predicate.completed.complement", [
    ...optionalPrefix(),
    patientTakingHead(),
    constituent("complement", "Complement", {
      minimum: 1,
      maximum: 2,
      cardinalityBound: "complements-per-predicate",
    }),
    lexical("aspect", ["AUX", "PART"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { aspect: "marked" },
    }),
  ]),
  production("ba-predicate.completed.aspect", [
    ...optionalPrefix(),
    patientTakingHead(),
    lexical("aspect", ["AUX", "PART"], { requiredFeatures: { aspect: "marked" } }),
  ]),
  production("ba-predicate.attested", [
    lexical("predicate", ["VERB"], {
      requiredFunctions: ["predicate"],
      requiredOccurrenceCapabilities: [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY],
    }),
  ]),
];

export const BA_PREDICATE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  BA_PREDICATE_PRODUCTION_RULES.flatMap(fixturesForRule);
