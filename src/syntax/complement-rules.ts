import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  SyntacticFunction,
  SyntaxCategory,
  SyntaxFeatureSet,
  Upos,
  ValencyFrame,
} from "./types.js";

interface Options {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly recursive?: boolean;
  readonly requiredFunctions?: readonly SyntacticFunction[];
  readonly requiredValencyFrames?: readonly ValencyFrame[];
  readonly requiredFeatures?: SyntaxFeatureSet;
  readonly inheritFunctions?: boolean;
  readonly inheritValencyFrames?: boolean;
  readonly formalLiteral?: string;
}

function constituent(
  key: string,
  category: SyntaxCategory,
  options: Options = {},
): ProductionConstituent {
  return {
    key,
    category,
    minimum: options.minimum ?? 1,
    maximum: options.maximum ?? 1,
    recursive: options.recursive ?? false,
    allowedUpos: [],
    requiredFunctions: options.requiredFunctions ?? [],
    requiredValencyFrames: options.requiredValencyFrames ?? [],
    requiredFeatures: options.requiredFeatures ?? {},
    ...(options.inheritFunctions ? { inheritFunctions: true } : {}),
    ...(options.inheritValencyFrames ? { inheritValencyFrames: true } : {}),
    ...(options.formalLiteral === undefined ? {} : { formalLiteral: options.formalLiteral }),
  };
}

function lexical(
  key: string,
  allowedUpos: readonly Upos[],
  options: Options = {},
): ProductionConstituent {
  return { ...constituent(key, "Lexeme", options), allowedUpos };
}

function production(
  id: string,
  output: SyntaxCategory,
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

function counts(rule: ProductionRule, maximum: boolean): Readonly<Record<string, number>> {
  return Object.fromEntries(rule.constituents.map((item) => [
    item.key,
    maximum ? item.maximum : item.minimum,
  ]));
}

function fixtures(rule: ProductionRule): readonly ProductionFixture[] {
  const order = rule.surfaceOrders[0];
  const first = rule.constituents[0];
  if (order === undefined || first === undefined) throw new Error(`invalid rule ${rule.id}`);
  const result: ProductionFixture[] = [{
    id: `${rule.id}:minimum`,
    ruleId: rule.id,
    expected: "accept",
    surfaceOrderId: order.id,
    constituentCounts: counts(rule, false),
  }];
  if (rule.positiveFixtureIds.includes(`${rule.id}:maximum`)) {
    result.push({
      id: `${rule.id}:maximum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: order.id,
      constituentCounts: counts(rule, true),
    });
  }
  result.push({
    id: `${rule.id}:overflow`,
    ruleId: rule.id,
    expected: "reject",
    surfaceOrderId: order.id,
    constituentCounts: { ...counts(rule, false), [first.key]: first.maximum + 1 },
  });
  return result;
}

export const COMPLEMENT_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("complement.result", "Complement", [
    constituent("result", "AdjectivePhrase", {
      recursive: true,
      requiredFunctions: ["complement"],
      requiredValencyFrames: ["resultative"],
    }),
  ]),
  production("complement.directional", "Complement", [
    lexical("direction", ["VERB"], { requiredFeatures: { complementType: "directional" } }),
  ]),
  production("complement.potential", "Complement", [
    lexical("linker", ["PART"], { requiredFeatures: { complementType: "potential" } }),
    lexical("result", ["VERB", "ADJ"]),
  ]),
  production("complement.degree", "Complement", [
    lexical("marker", ["PART"], { requiredFeatures: { complementType: "degree" } }),
    constituent("degree", "AdjectivePhrase", { recursive: true, requiredFunctions: ["complement"] }),
  ]),
  production("complement.quantity", "Complement", [
    constituent("quantity", "NumeralPhrase", { requiredFunctions: ["complement"] }),
  ]),
  production("complement.duration", "Complement", [
    constituent("duration", "NumeralPhrase", { requiredFunctions: ["complement"] }),
  ]),
  production("content.clause", "ContentClause", [
    constituent("complementizer", "ComplementizerPhrase", { minimum: 0, maximum: 1 }),
    constituent("clause", "Clause", { recursive: true }),
  ]),
  production("clause.subject-content", "Clause", [
    constituent("subjectClause", "ContentClause", { recursive: true, requiredFunctions: ["subject"] }),
    constituent("predicate", "VerbPhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.object-content", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1 }),
    constituent("predicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["clausal-complement"],
    }),
    constituent("objectClause", "ContentClause", { recursive: true, requiredFunctions: ["object"] }),
  ]),
  production("clause.complement-content", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1 }),
    constituent("predicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["open-clausal-complement"],
    }),
    constituent("complementClause", "ContentClause", {
      recursive: true,
      requiredFunctions: ["complement"],
    }),
  ]),
  production("relative.clause", "RelativeClause", [
    constituent("clause", "Clause", { recursive: true }),
    lexical("marker", ["PART"], { requiredFeatures: { clauseType: "relative" } }),
  ]),
  production("phrase.noun.relative", "NounPhrase", [
    constituent("relative", "RelativeClause", { recursive: true, requiredFunctions: ["modifier"] }),
    constituent("head", "NominalHead", { inheritFunctions: true }),
  ]),
  production("phrase.noun.de-nominalization", "NounPhrase", [
    constituent("clause", "Clause", { recursive: true }),
    lexical("marker", ["PART"], { requiredFeatures: { clauseType: "nominalized" } }),
  ]),
  production("quoted.clause", "QuotedClause", [
    lexical("openPunctuation", ["PUNCT"], { formalLiteral: "「" }),
    constituent("clause", "Clause", { recursive: true }),
    lexical("closePunctuation", ["PUNCT"], { formalLiteral: "」" }),
  ]),
  production("clause.quoted-content", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1 }),
    constituent("predicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["clausal-complement"],
    }),
    constituent("quotation", "QuotedClause", { recursive: true, requiredFunctions: ["object"] }),
  ]),
];

export const COMPLEMENT_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  COMPLEMENT_PRODUCTION_RULES.flatMap(fixtures);
