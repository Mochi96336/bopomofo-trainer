import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type {
  ProductionConstituent,
  ProductionFixture,
  ProductionRule,
  SyntaxCategory,
} from "./types.js";

interface ConstituentOptions {
  readonly recursive?: boolean;
}

function constituent(
  key: string,
  category: SyntaxCategory,
  options: ConstituentOptions = {},
): ProductionConstituent {
  return {
    key,
    category,
    minimum: 1,
    maximum: 1,
    recursive: options.recursive ?? false,
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

interface ArgumentRuleOptions {
  readonly key?: string;
  readonly category?: SyntaxCategory;
  readonly recursive?: boolean;
}

function argumentRule(
  id: string,
  output: ArgumentOutput,
  options: ArgumentRuleOptions = {},
): ProductionRule {
  const key = options.key ?? "phrase";
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
    constituents: [constituent(
      key,
      options.category ?? "NounPhrase",
      { recursive: options.recursive },
    )],
    surfaceOrders: [{ id: "canonical", constituentKeys: [key] }],
    constraints: [],
    positiveFixtureIds: [`${id}:minimum`],
    negativeFixtureIds: [`${id}:overflow`],
  };
}

function fixtures(rule: ProductionRule): readonly ProductionFixture[] {
  const argument = rule.constituents[0];
  if (argument === undefined) throw new Error(`argument rule ${rule.id} has no constituent`);
  return [
    {
      id: `${rule.id}:minimum`,
      ruleId: rule.id,
      expected: "accept",
      surfaceOrderId: "canonical",
      constituentCounts: { [argument.key]: 1 },
    },
    {
      id: `${rule.id}:overflow`,
      ruleId: rule.id,
      expected: "reject",
      surfaceOrderId: "canonical",
      constituentCounts: { [argument.key]: 2 },
    },
  ];
}

/**
 * Structural open-class arguments for Clause-model v2.
 *
 * The role is represented by the wrapper category itself. Nominal argument
 * children deliberately do not inherit corpus-observed dependency-function
 * gates. Subject additionally admits a recursive ContentClause realization,
 * grounded by the pinned csubj evidence contract; the structural Subject role
 * does not leak a permanent `subject` requirement into the embedded clause.
 *
 * Construction-specific DisposalPatient and PassiveAgent wrappers preserve the
 * formal BA/passive distinction without requiring a noun itself to have been
 * observed as `obl:patient` / `obl:agent` (or generic `obl`) in the finite UD
 * source corpus.
 */
export const ARGUMENT_PRODUCTION_RULES: readonly ProductionRule[] = [
  argumentRule("argument.subject.noun", "Subject"),
  argumentRule("argument.subject.clause", "Subject", {
    key: "clause",
    category: "ContentClause",
    recursive: true,
  }),
  argumentRule("argument.object.noun", "Object"),
  argumentRule("argument.indirect-object.noun", "IndirectObject"),
  argumentRule("argument.disposal-patient.noun", "DisposalPatient"),
  argumentRule("argument.passive-agent.noun", "PassiveAgent"),
];

export const ARGUMENT_PRODUCTION_FIXTURES: readonly ProductionFixture[] =
  ARGUMENT_PRODUCTION_RULES.flatMap(fixtures);
