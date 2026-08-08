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

interface ConstituentOptions {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly recursive?: boolean;
  readonly allowedUpos?: readonly Upos[];
  readonly requiredFunctions?: readonly SyntacticFunction[];
  readonly requiredValencyFrames?: readonly ValencyFrame[];
  readonly requiredFeatures?: SyntaxFeatureSet;
  readonly entryBinding?: string;
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
    ...(options.entryBinding === undefined ? {} : { entryBinding: options.entryBinding }),
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

const subject = () => constituent("subject", "NounPhrase", { requiredFunctions: ["subject"] });
const object = () => constituent("object", "NounPhrase", { requiredFunctions: ["object"] });
const predicate = (frames: readonly ValencyFrame[]) => constituent("predicate", "VerbPhrase", {
  requiredFunctions: ["predicate"],
  requiredValencyFrames: frames,
});

const aNotALexeme = (
  key: string,
  frames: readonly ValencyFrame[],
) => lexical(key, ["VERB"], {
  requiredFunctions: ["predicate"],
  requiredValencyFrames: frames,
  entryBinding: "a-not-a-predicate",
});

export const CLAUSE_PRODUCTION_RULES: readonly ProductionRule[] = [
  production("clause.nominal-predicate", "Clause", [
    subject(),
    constituent("predicate", "NounPhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.adjective-predicate", "Clause", [
    subject(),
    constituent("predicate", "AdjectivePhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.intransitive", "Clause", [subject(), predicate(["intransitive", "ambitransitive"])]),
  production("clause.transitive", "Clause", [
    subject(),
    predicate(["transitive", "ambitransitive"]),
    object(),
  ]),
  production("clause.ditransitive", "Clause", [
    subject(),
    predicate(["ditransitive"]),
    constituent("indirectObject", "NounPhrase", { requiredFunctions: ["indirect-object"] }),
    object(),
  ]),
  production("clause.copular", "Clause", [
    subject(),
    lexical("copula", ["AUX", "VERB"], { requiredFunctions: ["copula"] }),
    constituent("predicate", "NounPhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.existential", "Clause", [
    constituent("locative", "AdpositionPhrase", { minimum: 0, maximum: 1 }),
    lexical("predicate", ["VERB"], {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["intransitive", "transitive", "ambitransitive"],
      requiredFeatures: { clauseType: "existential" },
    }),
    constituent("postverbalNominal", "NounPhrase"),
  ]),
  production("clause.locative", "Clause", [
    subject(),
    lexical("copula", ["AUX", "VERB"], { requiredFunctions: ["copula"] }),
    constituent("location", "AdpositionPhrase", { requiredFunctions: ["oblique"] }),
  ]),
  production("clause.modal", "Clause", [
    subject(),
    lexical("modal", ["AUX"], { requiredFunctions: ["auxiliary"] }),
    predicate([
      "intransitive", "transitive", "ditransitive", "ambitransitive",
      "clausal-complement", "open-clausal-complement", "adpositional-complement",
    ]),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 1 }),
  ]),
  production("clause.negative", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    lexical("negation", ["ADV", "AUX", "PART", "VERB"], { requiredFeatures: { polarity: "negative" } }),
    constituent("predicate", "VerbPhrase", { requiredFunctions: ["predicate"] }),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 1 }),
  ]),
  production("clause.aspect", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    constituent("predicate", "VerbPhrase", { requiredFunctions: ["predicate"] }),
    lexical("aspect", ["AUX", "PART"], { requiredFeatures: { aspect: "marked" } }),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 1 }),
  ]),
  production("clause.ba", "Clause", [
    subject(),
    lexical("marker", ["ADP"], { requiredFeatures: { voice: "disposal" } }),
    object(),
    predicate(["transitive", "ambitransitive", "resultative"]),
  ]),
  production("clause.bei", "Clause", [
    constituent("patient", "NounPhrase", { requiredFunctions: ["subject"] }),
    lexical("marker", ["ADP", "AUX"], { requiredFeatures: { voice: "passive" } }),
    constituent("agent", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["oblique"] }),
    predicate(["transitive", "ambitransitive"]),
  ]),
  production("clause.causative", "Clause", [
    subject(),
    predicate(["causative"]),
    constituent("causee", "NounPhrase", { requiredFunctions: ["object"] }),
    constituent("resultPredicate", "VerbPhrase", { requiredFunctions: ["complement"] }),
  ]),
  production("clause.pivotal", "Clause", [
    subject(),
    predicate(["transitive", "ambitransitive", "causative"]),
    constituent("pivot", "NounPhrase", { requiredFunctions: ["object", "subject"] }),
    constituent("secondaryPredicate", "VerbPhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.serial-verb", "Clause", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    constituent("firstPredicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["serial-verb", "intransitive", "transitive", "ambitransitive"],
    }),
    constituent("secondPredicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["serial-verb", "intransitive", "transitive", "ambitransitive"],
    }),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 1 }),
  ]),
  production("clause.comparative", "Clause", [
    subject(),
    lexical("marker", ["ADP"], { requiredFeatures: { clauseType: "comparative" } }),
    constituent("standard", "NounPhrase", { requiredFunctions: ["oblique"] }),
    constituent("predicate", "AdjectivePhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.topic-comment", "Clause", [
    constituent("topicPhrase", "NounPhrase", { requiredFunctions: ["modifier"] }),
    constituent("comment", "VerbPhrase", { requiredFunctions: ["predicate"] }),
  ]),
  production("clause.subject-omission", "Clause", [
    predicate([
      "intransitive", "transitive", "ditransitive", "ambitransitive",
      "clausal-complement", "open-clausal-complement", "adpositional-complement",
    ]),
    constituent("object", "NounPhrase", { minimum: 0, maximum: 1 }),
  ]),
  production("clause.object-omission", "Clause", [
    subject(),
    predicate(["transitive", "ditransitive", "ambitransitive"]),
  ]),
  production("sentence.declarative", "Sentence", [
    constituent("clause", "Clause"),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.request", "Sentence", [
    lexical("marker", ["ADV", "AUX", "PART", "VERB"], { requiredFeatures: { clauseType: "request" } }),
    constituent("clause", "Clause"),
  ]),
  production("sentence.exclamative", "Sentence", [
    constituent("interjection", "InterjectionPhrase"),
    constituent("clause", "Clause"),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.polar-question", "Sentence", [
    constituent("clause", "Clause"),
    lexical("questionParticle", ["PART"], { requiredFeatures: { questionType: "polar" } }),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.a-not-a-question", "Sentence", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    aNotALexeme("positivePredicate", ["intransitive", "ambitransitive"]),
    lexical("negation", ["ADV", "AUX", "PART"], { requiredFeatures: { polarity: "negative" } }),
    aNotALexeme("negativePredicate", ["intransitive", "ambitransitive"]),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.a-not-a-transitive-question", "Sentence", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    aNotALexeme("positivePredicate", ["transitive", "ambitransitive"]),
    lexical("negation", ["ADV", "AUX", "PART"], { requiredFeatures: { polarity: "negative" } }),
    aNotALexeme("negativePredicate", ["transitive", "ambitransitive"]),
    object(),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.alternative-question", "Sentence", [
    constituent("firstClause", "Clause"),
    lexical("connector", ["CCONJ", "PART"], { requiredFeatures: { questionType: "alternative" } }),
    constituent("secondClause", "Clause"),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.constituent-question", "Sentence", [
    constituent("subject", "NounPhrase", { minimum: 0, maximum: 1, requiredFunctions: ["subject"] }),
    constituent("predicate", "VerbPhrase", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["transitive", "ambitransitive"],
    }),
    lexical("questionPhrase", ["PRON", "NOUN", "DET", "NUM"], {
      requiredFunctions: ["object"],
      requiredFeatures: { questionType: "constituent" },
    }),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
  production("sentence.constituent-subject-question", "Sentence", [
    lexical("questionPhrase", ["PRON", "NOUN", "DET", "NUM"], {
      requiredFunctions: ["subject"],
      requiredFeatures: { questionType: "constituent" },
    }),
    constituent("predicate", "VerbPhrase", { requiredFunctions: ["predicate"] }),
    constituent("punctuation", "Punctuation", { minimum: 0, maximum: 1 }),
  ]),
];

export const CLAUSE_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  CLAUSE_PRODUCTION_RULES.flatMap(fixturesForRule);
