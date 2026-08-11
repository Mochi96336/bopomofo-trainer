import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  SyntaxCategory,
} from "./types.js";

function constituent(key: string, category: SyntaxCategory): ProductionConstituent {
  return {
    key,
    category,
    minimum: 1,
    maximum: 1,
    recursive: false,
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

function argumentRule(id: string, output: ArgumentOutput): ProductionRule {
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
    constituents: [constituent("phrase", "NounPhrase")],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["phrase"] }],
    constraints: [],
    positiveFixtureIds: [`${id}:minimum`],
    negativeFixtureIds: [`${id}:overflow`],
  };
}

function fixtures(rule: ProductionRule): readonly ProductionFixture[] {
  return [
    {
      id: `${rule.id}:minimum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: "canonical",
      constituentCounts: { phrase: 1 },
    },
    {
      id: `${rule.id}:overflow`,
      ruleId: rule.id,
      expected: "reject",
      surfaceOrderId: "canonical",
      constituentCounts: { phrase: 2 },
    },
  ];
}

/**
 * Structural open-class nominal arguments for Clause-model v2.
 *
 * The role is represented by the wrapper category itself. The child NounPhrase
 * deliberately does not inherit a corpus-observed dependency-function gate.
 * Subject/Object/IndirectObject are ordinary argument positions; the
 * construction-specific DisposalPatient and PassiveAgent wrappers preserve the
 * formal BA/passive distinction without requiring a noun itself to have been
 * observed as `obl:patient` / `obl:agent` (or generic `obl`) in the finite UD
 * source corpus.
 */
export const ARGUMENT_PRODUCTION_RULES: readonly ProductionRule[] = [
  argumentRule("argument.subject.noun", "Subject"),
  argumentRule("argument.object.noun", "Object"),
  argumentRule("argument.indirect-object.noun", "IndirectObject"),
  argumentRule("argument.disposal-patient.noun", "DisposalPatient"),
  argumentRule("argument.passive-agent.noun", "PassiveAgent"),
];

export const ARGUMENT_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  ARGUMENT_PRODUCTION_RULES.flatMap(fixtures);
