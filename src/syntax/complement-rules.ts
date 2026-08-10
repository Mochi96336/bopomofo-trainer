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

const SUBJECT_CONTROL_RULE: ProductionRule = {
  id: "clause.xcomp-subject-control",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Clause",
  constituents: [
    constituent("controller", "Subject", { minimum: 0, maximum: 1 }),
    constituent("predicate", "Predicate", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["open-clausal-complement"],
    }),
    constituent("openClause", "OpenClause", {
      recursive: true,
      requiredFunctions: ["complement"],
    }),
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["controller", "predicate", "openClause"] }],
  constraints: [{
    kind: "requires-constituent",
    ifPresentKey: "openClause",
    targetKey: "controller",
  }],
  positiveFixtureIds: ["clause.xcomp-subject-control:controlled"],
  negativeFixtureIds: [
    "clause.xcomp-subject-control:missing-controller",
    "clause.xcomp-subject-control:overflow",
  ],
};

const OBJECT_CONTROL_RULE: ProductionRule = {
  id: "clause.xcomp-object-control",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Clause",
  constituents: [
    constituent("subject", "Subject", { minimum: 0, maximum: 1 }),
    constituent("predicate", "Predicate", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["open-clausal-complement"],
    }),
    constituent("controller", "Object", { minimum: 0, maximum: 1 }),
    constituent("openClause", "OpenClause", {
      recursive: true,
      requiredFunctions: ["complement"],
    }),
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "controller", "openClause"],
  }],
  constraints: [{
    kind: "requires-constituent",
    ifPresentKey: "openClause",
    targetKey: "controller",
  }],
  positiveFixtureIds: [
    "clause.xcomp-object-control:controlled",
    "clause.xcomp-object-control:controlled-with-subject",
  ],
  negativeFixtureIds: [
    "clause.xcomp-object-control:missing-controller",
    "clause.xcomp-object-control:overflow",
  ],
};

const CONTROL_FIXTURES: readonly ProductionFixture[] = [
  {
    id: "clause.xcomp-subject-control:controlled",
    ruleId: SUBJECT_CONTROL_RULE.id,
    expected: "accept",
    surfaceOrderId: "canonical",
    constituentCounts: { controller: 1, predicate: 1, openClause: 1 },
  },
  {
    id: "clause.xcomp-subject-control:missing-controller",
    ruleId: SUBJECT_CONTROL_RULE.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { controller: 0, predicate: 1, openClause: 1 },
  },
  {
    id: "clause.xcomp-subject-control:overflow",
    ruleId: SUBJECT_CONTROL_RULE.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { controller: 2, predicate: 1, openClause: 1 },
  },
  {
    id: "clause.xcomp-object-control:controlled",
    ruleId: OBJECT_CONTROL_RULE.id,
    expected: "accept",
    surfaceOrderId: "canonical",
    constituentCounts: { subject: 0, predicate: 1, controller: 1, openClause: 1 },
  },
  {
    id: "clause.xcomp-object-control:controlled-with-subject",
    ruleId: OBJECT_CONTROL_RULE.id,
    expected: "accept",
    surfaceOrderId: "canonical",
    constituentCounts: { subject: 1, predicate: 1, controller: 1, openClause: 1 },
  },
  {
    id: "clause.xcomp-object-control:missing-controller",
    ruleId: OBJECT_CONTROL_RULE.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { subject: 0, predicate: 1, controller: 0, openClause: 1 },
  },
  {
    id: "clause.xcomp-object-control:overflow",
    ruleId: OBJECT_CONTROL_RULE.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { subject: 2, predicate: 1, controller: 1, openClause: 1 },
  },
];

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

  // An OpenClause is a controlled predication with no Subject constituent of its own.
  // Matrix Clause rules below own the controller explicitly.
  production("open-clause.intransitive", "OpenClause", [
    constituent("predicate", "Predicate", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["intransitive", "ambitransitive"],
    }),
  ]),
  production("open-clause.transitive", "OpenClause", [
    constituent("predicate", "Predicate", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["transitive", "ambitransitive"],
    }),
    constituent("object", "Object"),
  ]),
  production("open-clause.ditransitive", "OpenClause", [
    constituent("predicate", "Predicate", {
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["ditransitive"],
    }),
    constituent("indirectObject", "IndirectObject"),
    constituent("object", "Object"),
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
  SUBJECT_CONTROL_RULE,
  OBJECT_CONTROL_RULE,
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

export const COMPLEMENT_PRODUCTION_FIXTURES: readonly ProductionFixture[] = [
  ...COMPLEMENT_PRODUCTION_RULES.filter((rule) => rule.constraints.length === 0).flatMap(fixtures),
  ...CONTROL_FIXTURES,
];
