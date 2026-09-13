import { appendFileSync, writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  predicateMarkingPracticeIntentForTicketUnit,
  type FormalSyntaxSamplingPolicy,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import type { StructuralLexicalSlot } from "../src/syntax/derive.js";
import { FORMAL_GRAMMAR_VERSION } from "../src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../src/syntax/realize.js";
import type {
  ProductionConstituent,
  ProductionRule,
  SyntaxCategory,
  SyntaxFeatureSet,
  Upos,
} from "../src/syntax/types.js";

const sampleCount = Number.parseInt(process.env.SAMPLE_COUNT ?? "1024", 10);
const baselineMode = process.env.BASELINE === "1";
const aspectWeight = baselineMode ? 0 : Number.parseFloat(process.env.ASPECT_WEIGHT ?? "0.057");
const label = baselineMode ? "baseline-259" : `aspect-${aspectWeight.toFixed(4)}`;
const NEGATION = 0.057;
const NEGATION_BOUNDARY = 0.943;
const SEED_NAMESPACE = "aspect-predicate-marking-parallel-probe";

if (!Number.isInteger(sampleCount) || sampleCount <= 0) throw new Error("SAMPLE_COUNT must be positive integer");
if (!baselineMode && (!Number.isFinite(aspectWeight) || aspectWeight < 0 || aspectWeight >= NEGATION_BOUNDARY)) {
  throw new Error("ASPECT_WEIGHT out of range");
}

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

function constituent(
  key: string,
  category: SyntaxCategory,
  options: {
    readonly minimum?: number;
    readonly maximum?: number;
    readonly allowedUpos?: readonly Upos[];
    readonly requiredFunctions?: readonly "predicate"[];
    readonly requiredFeatures?: SyntaxFeatureSet;
  } = {},
): ProductionConstituent {
  return {
    key,
    category,
    minimum: options.minimum ?? 1,
    maximum: options.maximum ?? 1,
    recursive: false,
    allowedUpos: options.allowedUpos ?? [],
    requiredFunctions: options.requiredFunctions ?? [],
    requiredValencyFrames: [],
    requiredFeatures: options.requiredFeatures ?? {},
  };
}

const clauseAspect: ProductionRule = {
  id: "clause.aspect",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Clause",
  constituents: [
    constituent("subject", "Subject", { minimum: 0, maximum: 1 }),
    constituent("predicate", "Predicate", { requiredFunctions: ["predicate"] }),
    constituent("aspect", "Lexeme", { allowedUpos: ["AUX", "PART"], requiredFeatures: { aspect: "marked" } }),
    constituent("object", "Object", { minimum: 0, maximum: 1 }),
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "predicate", "aspect", "object"] }],
  constraints: [],
  positiveFixtureIds: ["clause.aspect:minimum", "clause.aspect:maximum"],
  negativeFixtureIds: ["clause.aspect:overflow"],
};

const aspectSlot: StructuralLexicalSlot = {
  kind: "lexical-slot",
  id: "probe:aspect",
  constituentKey: "aspect",
  occurrenceIndex: 0,
  allowedUpos: ["AUX", "PART"],
  requiredFunctions: [],
  requiredValencyFrames: [],
  requiredFeatures: { aspect: "marked" },
};
const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const aspectProfileIds = new Set(compatibleProfilesForSlot(aspectSlot, index).map((profile) => profile.id));
if (aspectProfileIds.size === 0) throw new Error("empty aspect frontier");

const policy: FormalSyntaxSamplingPolicy = {
  ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  version: `aspect-parallel-probe-${label}`,
  predicateMarkingPracticeWeights: baselineMode
    ? { ordinary: 0.943, aspect: 0, negation: NEGATION }
    : { ordinary: Math.round((NEGATION_BOUNDARY - aspectWeight) * 10_000) / 10_000, aspect: aspectWeight, negation: NEGATION },
};
if (predicateMarkingPracticeIntentForTicketUnit(0.943, policy) !== "negation"
  || predicateMarkingPracticeIntentForTicketUnit(0.942999999999, policy) === "negation") {
  throw new Error("negation boundary drift");
}

function run(): { success: number; aspectExposure: number; aspectShare: number } {
  let success = 0;
  let aspectExposure = 0;
  for (let round = 0; round < sampleCount; round += 1) {
    const composition = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: createSeededRandom(`${SEED_NAMESPACE}:${round}`),
      samplingMode: "product-family",
      samplingPolicy: policy,
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 64,
      bounds: PRODUCT_BOUNDS,
    });
    const candidate = composition.candidates[0] ?? null;
    if (candidate !== null) success += 1;
    if ((candidate?.syntaxProfileIds ?? []).some((id) => aspectProfileIds.has(id))) aspectExposure += 1;
  }
  return { success, aspectExposure, aspectShare: aspectExposure / sampleCount };
}

let result: { success: number; aspectExposure: number; aspectShare: number };
if (baselineMode) {
  const rules = FORMAL_SYNTAX_RULES as ProductionRule[];
  const insertAt = rules.findIndex((rule) => rule.id === "clause.ba");
  if (insertAt < 0 || rules.some((rule) => rule.id === "clause.aspect")) throw new Error("baseline reconstruction seam invalid");
  rules.splice(insertAt, 0, clauseAspect);
  try {
    result = run();
  } finally {
    const index = rules.indexOf(clauseAspect);
    if (index >= 0) rules.splice(index, 1);
  }
} else {
  result = run();
}

const report = {
  schemaVersion: "aspect-predicate-marking-parallel-probe-v1",
  label,
  baselineMode,
  aspectWeight,
  ordinaryWeight: policy.predicateMarkingPracticeWeights.ordinary,
  negationWeight: NEGATION,
  negationBoundary: NEGATION_BOUNDARY,
  sampleCount,
  exactAspectProfileCount: aspectProfileIds.size,
  ...result,
};
const json = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(`aspect-probe-${label}.json`, json, "utf8");
console.log(`aspect-parallel-probe ${JSON.stringify(report)}`);
const summary = `## ${label}\n\n- samples: **${sampleCount}**\n- success: **${result.success}**\n- aspect exposure: **${result.aspectExposure}/${sampleCount} (${(result.aspectShare * 100).toFixed(3)}%)**\n- ordinary/aspect/negation: **${policy.predicateMarkingPracticeWeights.ordinary.toFixed(3)} / ${policy.predicateMarkingPracticeWeights.aspect.toFixed(3)} / ${NEGATION.toFixed(3)}**\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
