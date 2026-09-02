import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ConstituentCardinalityBound,
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  ProductionRuleClass,
  SyntacticFunction,
  SyntaxCategory,
  SyntaxFeatureSet,
  Upos,
  ValencyFrame,
} from "./types.js";
import { assertValidGrammarBundle } from "./validate.js";
import {
  BA_PREDICATE_PRODUCTION_FIXTURES,
  BA_PREDICATE_PRODUCTION_RULES,
} from "./ba-predicate-rules.js";
import {
  CLAUSE_PRODUCTION_FIXTURES,
  CLAUSE_PRODUCTION_RULES,
} from "./clause-rules.js";
import {
  COMPLEMENT_PRODUCTION_FIXTURES,
  COMPLEMENT_PRODUCTION_RULES,
} from "./complement-rules.js";
import {
  PREDICATE_PRODUCTION_FIXTURES,
  PREDICATE_PRODUCTION_RULES,
} from "./predicate-rules.js";

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
  readonly cardinalityBound?: ConstituentCardinalityBound;
  readonly excludedRuleClasses?: readonly ProductionRuleClass[];
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
    ...(options.cardinalityBound === undefined ? {} : { cardinalityBound: options.cardinalityBound }),
    ...(options.excludedRuleClasses === undefined ? {} : { excludedRuleClasses: options.excludedRuleClasses }),
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
  output: SyntaxCategory,
  constituents: readonly ProductionConstituent[],
  surfaceOrders: readonly { readonly id: string; readonly constituentKeys: readonly string[] }[] = [{
    id: "canonical",
    constituentKeys: constituents.map((item) => item.key),
  }],
): ProductionRule {
  const hasVariableCardinality = constituents.some((item) => item.minimum !== item.maximum);
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
    constituents,
    surfaceOrders,
    constraints: [],
    positiveFixtureIds: hasVariableCardinality
      ? [`${id}:minimum`, `${id}:maximum`]
      : [`${id}:minimum`],
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
  const fixtures: ProductionFixture[] = [{
    id: `${rule.id}:minimum`,
    ruleId: rule.id,
    expected: "accept",
    surfaceOrderId: order.id,
    constituentCounts: countsFor(rule, "minimum"),
  }];
  if (rule.positiveFixtureIds.includes(`${rule.id}:maximum`)) {
    fixtures.push({
      id: `${rule.id}:maximum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: order.id,
      constituentCounts: countsFor(rule, "maximum"),
    });
  }
  fixtures.push({
    id: `${rule.id}:overflow`,
    ruleId: rule.id,
    expected: "reject",
    surfaceOrderId: order.id,
    constituentCounts: { ...countsFor(rule, "minimum"), [first.key]: first.maximum + 1 },
  });
  return fixtures;
}

function coordinationItem(
  key: string,
  category: SyntaxCategory,
  inheritHeadRequirements = false,
): ProductionConstituent {
  return constituent(key, category, {
    recursive: true,
    inheritFunctions: inheritHeadRequirements,
    inheritValencyFrames: inheritHeadRequirements,
    excludedRuleClasses: ["coordination"],
  });
}

function coordinationRules(id: string, category: SyntaxCategory): readonly ProductionRule[] {
  const two: ProductionRule = {
    ...production(id, category, [
      coordinationItem("first", category, true),
      lexical("connector", ["CCONJ"], { requiredFunctions: ["coordinator"] }),
      coordinationItem("second", category),
    ]),
    ruleClass: "coordination",
    coordinationItems: 2,
  };
  const threeId = `${id}.three`;
  const three: ProductionRule = {
    ...production(threeId, category, [
      coordinationItem("first", category, true),
      lexical("firstConnector", ["CCONJ"], { requiredFunctions: ["coordinator"] }),
      coordinationItem("second", category),
      lexical("secondConnector", ["CCONJ"], { requiredFunctions: ["coordinator"] }),
      coordinationItem("third", category),
    ]),
    ruleClass: "coordination",
    coordinationItems: 3,
  };
  return [two, three];
}

export const PHRASE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("phrase.nominal-head.noun", "NominalHead", [
    lexical("head", ["NOUN"], { inheritFunctions: true }),
  ]),
  production("phrase.nominal-head.pronoun", "NominalHead", [
    lexical("head", ["PRON"], { inheritFunctions: true }),
  ]),
  production("phrase.nominal-head.proper", "NominalHead", [
    lexical("head", ["PROPN"], { inheritFunctions: true }),
  ]),
  production("phrase.noun.bare", "NounPhrase", [
    constituent("head", "NominalHead", { inheritFunctions: true }),
  ]),
  production("phrase.noun.expanded", "NounPhrase", [
    constituent("determiner", "DeterminerPhrase", { minimum: 0, maximum: 1 }),
    constituent("numeral", "NumeralPhrase", { minimum: 0, maximum: 1 }),
    constituent("modifier", "AdjectivePhrase", {
      minimum: 0,
      maximum: 3,
      cardinalityBound: "consecutive-modifiers",
    }),
    constituent("head", "NominalHead", { inheritFunctions: true }),
  ]),
  production("phrase.determiner.lexical", "DeterminerPhrase", [
    lexical("head", ["DET"], { requiredFunctions: ["determiner"] }),
  ]),
  production("phrase.numeral.lexical", "NumeralPhrase", [
    lexical("number", ["NUM"], { requiredFunctions: ["numeral"] }),
  ]),
  production("phrase.numeral.classifier", "NumeralPhrase", [
    lexical("number", ["NUM"], { requiredFunctions: ["numeral"] }),
    // UD Chinese analyzes classifiers as NOUN dependents with relation `clf`.
    lexical("classifier", ["NOUN"], { requiredFunctions: ["classifier"] }),
  ]),
  production("phrase.adjective.lexical", "AdjectivePhrase", [
    lexical("head", ["ADJ"], { inheritFunctions: true, inheritValencyFrames: true }),
  ]),
  production("phrase.adjective.modified", "AdjectivePhrase", [
    constituent("degree", "AdverbPhrase", { minimum: 0, maximum: 1 }),
    lexical("negation", ["ADV", "AUX", "PART", "VERB"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { polarity: "negative" },
    }),
    lexical("head", ["ADJ"], { inheritFunctions: true, inheritValencyFrames: true }),
    constituent("complement", "Complement", { minimum: 0, maximum: 1 }),
  ]),
  production("phrase.adverb.lexical", "AdverbPhrase", [
    lexical("head", ["ADV"], { inheritFunctions: true }),
  ]),
  production("phrase.adverb.degree", "AdverbPhrase", [
    lexical("degree", ["ADV"], { requiredFunctions: ["modifier"] }),
    lexical("head", ["ADV"], { inheritFunctions: true }),
  ]),
  // The head of an adposition phrase is the adposition, not its object, so the
  // enclosing phrase's function is not inherited through this edge. Inheriting
  // it would demand that the noun inside 在<NP> itself be an oblique dependent,
  // when it is the object of the adposition and the phrase is the oblique.
  production("phrase.adposition.preposed", "AdpositionPhrase", [
    lexical("head", ["ADP"], { requiredFunctions: ["adposition"] }),
    constituent("object", "NounPhrase"),
  ]),
  production("phrase.adposition.postposed", "AdpositionPhrase", [
    constituent("object", "NounPhrase"),
    lexical("head", ["PART"], { requiredFunctions: ["adposition"] }),
  ]),
  production("phrase.particle.lexical", "ParticlePhrase", [lexical("head", ["PART"])]),
  production("phrase.complementizer.lexical", "ComplementizerPhrase", [
    lexical("head", ["SCONJ"], { requiredFunctions: ["marker"] }),
  ]),
  production("phrase.verb.lexical", "VerbPhrase", [
    lexical("head", ["VERB"], { inheritFunctions: true, inheritValencyFrames: true }),
  ]),
  production("phrase.verb.expanded", "VerbPhrase", [
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
    lexical("head", ["VERB"], { inheritFunctions: true, inheritValencyFrames: true }),
    constituent("complement", "Complement", {
      minimum: 0,
      maximum: 2,
      cardinalityBound: "complements-per-predicate",
    }),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 2 }),
    lexical("aspect", ["AUX", "PART"], {
      minimum: 0,
      maximum: 1,
      requiredFeatures: { aspect: "marked" },
    }),
  ]),
  production("phrase.interjection.lexical", "InterjectionPhrase", [lexical("head", ["INTJ"])]),
  production("phrase.symbol.lexical", "SymbolPhrase", [lexical("head", ["SYM"])]),
  production("phrase.unknown.lexical", "UnknownPhrase", [lexical("head", ["X"])]),
  production("phrase.punctuation.lexical", "Punctuation", [
    lexical("head", ["PUNCT"], { requiredFunctions: ["punctuation"] }),
  ]),
  ...coordinationRules("phrase.noun.coordination", "NounPhrase"),
  ...coordinationRules("phrase.verb.coordination", "VerbPhrase"),
  ...coordinationRules("phrase.adjective.coordination", "AdjectivePhrase"),
  ...coordinationRules("phrase.adverb.coordination", "AdverbPhrase"),
  ...coordinationRules("phrase.adposition.coordination", "AdpositionPhrase"),
];

export const PHRASE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  PHRASE_PRODUCTION_RULES.flatMap(fixturesForRule);

export const FORMAL_SYNTAX_RULES: readonly ProductionRule[] = [
  ...PHRASE_PRODUCTION_RULES,
  ...PREDICATE_PRODUCTION_RULES,
  ...BA_PREDICATE_PRODUCTION_RULES,
  ...CLAUSE_PRODUCTION_RULES,
  ...COMPLEMENT_PRODUCTION_RULES,
];
export const FORMAL_SYNTAX_FIXTURES: readonly ProductionFixture[] = [
  ...PHRASE_PRODUCTION_FIXTURES,
  ...PREDICATE_PRODUCTION_FIXTURES,
  ...BA_PREDICATE_PRODUCTION_FIXTURES,
  ...CLAUSE_PRODUCTION_FIXTURES,
  ...COMPLEMENT_PRODUCTION_FIXTURES,
];

export { BA_PREDICATE_PRODUCTION_FIXTURES, BA_PREDICATE_PRODUCTION_RULES };
export { CLAUSE_PRODUCTION_FIXTURES, CLAUSE_PRODUCTION_RULES };
export { COMPLEMENT_PRODUCTION_FIXTURES, COMPLEMENT_PRODUCTION_RULES };
export { PREDICATE_PRODUCTION_FIXTURES, PREDICATE_PRODUCTION_RULES };

assertValidGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES);
