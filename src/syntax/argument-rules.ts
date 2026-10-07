import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  SyntaxCategory,
} from "./types.js";

function constituent(
  key: string,
  category: SyntaxCategory,
  recursive = false,
): ProductionConstituent {
  return {
    key,
    category,
    minimum: 1,
    maximum: 1,
    recursive,
    allowedUpos: [],
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {},
  };
}

const ARGUMENT_OUTPUTS = [
  "Subject",
  "Object",
  "IndirectObject",
  "DisposalPatient",
  "PassiveAgent",
] as const satisfies readonly SyntaxCategory[];

type ArgumentOutput = (typeof ARGUMENT_OUTPUTS)[number];

function argumentRule(
  id: string,
  output: ArgumentOutput,
  childCategory: SyntaxCategory = "NounPhrase",
  childKey = "phrase",
  recursive = false,
): ProductionRule {
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
    constituents: [constituent(childKey, childCategory, recursive)],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["phrase"] }],
    constraints: [],
    positiveFixtureIds: [`${id}:minimum`],
    negativeFixtureIds: [`${id}:overflow`],
  };
}

function fixtures(rule: ProductionRule): readonly ProductionFixture[] {
  const child = rule.constituents[0];
  if (child === undefined) throw new Error(`argument rule ${rule.id} requires one child`);
  return [
    {
      id: `${rule.id}:minimum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: "canonical",
      constituentCounts: { [child.key]: 1 },
    },
    {
      id: `${rule.id}:overflow`,
      ruleId: rule.id,
      expected: "reject",
      surfaceOrderId: "canonical",
      constituentCounts: { [child.key]: 2 },
    },
  ];
}

/**
 * Structural arguments for Clause-model v2.
 *
 * The role is represented by the wrapper category itself. Nominal children
 * deliberately do not inherit corpus-observed dependency-function gates.
 * Reviewed csubj evidence adds a clausal Subject alternative while preserving
 * the embedded ContentClause's own internal Clause frame and argument
 * realization.
 */
export const ARGUMENT_PRODUCTION_RULES: readonly ProductionRule[] = [
  argumentRule("argument.subject.noun", "Subject"),
  argumentRule("argument.subject.clause", "Subject", "ContentClause", "clause", true),
  argumentRule("argument.object.noun", "Object"),
  argumentRule("argument.indirect-object.noun", "IndirectObject"),
  argumentRule("argument.disposal-patient.noun", "DisposalPatient"),
  argumentRule("argument.passive-agent.noun", "PassiveAgent"),
];

export const ARGUMENT_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  ARGUMENT_PRODUCTION_RULES.flatMap(fixtures);
