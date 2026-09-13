import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  predicateMarkingPracticeIntentForTicketUnit,
  type FormalSyntaxSamplingPolicy,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
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

const BASE_HEAD = "4d97bfec67946df620cf8a5d70bc87b704edfa75";
const IMPLEMENTATION_HEAD = "970aa87c7e01ba2b51afe6ee601128c79d5a78f6";
const SEED_NAMESPACE = "aspect-predicate-marking-calibration-v2";
const FINAL_COUNT = 2048;
const COARSE_COUNT = 256;
const FINE_COUNT = 512;
const NEGATION_WEIGHT = 0.057;
const NEGATION_BOUNDARY = 0.943;

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

interface RecordRow {
  readonly success: boolean;
  readonly aspect: boolean;
  readonly root: string | null;
  readonly family: string | null;
  readonly fallback: string;
  readonly derivation: string | null;
  readonly text: string | null;
}

interface Summary {
  readonly sampleCount: number;
  readonly success: number;
  readonly aspectExposure: number;
  readonly aspectShare: number;
  readonly roots: Readonly<Record<string, number>>;
  readonly families: Readonly<Record<string, number>>;
}

interface Measurement {
  readonly weight: number;
  readonly records: readonly RecordRow[];
  readonly summary: Summary;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function objectFromCounts(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function roundWeight(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

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

const CLAUSE_ASPECT_RULE: ProductionRule = {
  id: "clause.aspect",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Clause",
  constituents: [
    constituent("subject", "Subject", { minimum: 0, maximum: 1 }),
    constituent("predicate", "Predicate", { requiredFunctions: ["predicate"] }),
    constituent("aspect", "Lexeme", {
      allowedUpos: ["AUX", "PART"],
      requiredFeatures: { aspect: "marked" },
    }),
    constituent("object", "Object", { minimum: 0, maximum: 1 }),
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "predicate", "aspect", "object"] }],
  constraints: [],
  positiveFixtureIds: ["clause.aspect:minimum", "clause.aspect:maximum"],
  negativeFixtureIds: ["clause.aspect:overflow"],
};

const aspectSlot: StructuralLexicalSlot = {
  kind: "lexical-slot",
  id: "audit:aspect-marked",
  constituentKey: "aspect",
  occurrenceIndex: 0,
  allowedUpos: ["AUX", "PART"],
  requiredFunctions: [],
  requiredValencyFrames: [],
  requiredFeatures: { aspect: "marked" },
};

const profileIndex = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const aspectProfiles = new Set(
  compatibleProfilesForSlot(aspectSlot, profileIndex).map((profile) => profile.id),
);
if (aspectProfiles.size === 0) throw new Error("empty exact aspect profile frontier");

function policy(weight: number): FormalSyntaxSamplingPolicy {
  const aspect = roundWeight(weight);
  const ordinary = roundWeight(NEGATION_BOUNDARY - aspect);
  const result: FormalSyntaxSamplingPolicy = {
    ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
    version: `aspect-calibration-fast-${aspect.toFixed(4)}`,
    predicateMarkingPracticeWeights: { ordinary, aspect, negation: NEGATION_WEIGHT },
  };
  if (predicateMarkingPracticeIntentForTicketUnit(NEGATION_BOUNDARY, result) !== "negation"
    || predicateMarkingPracticeIntentForTicketUnit(NEGATION_BOUNDARY - 1e-12, result) === "negation") {
    throw new Error(`negation boundary drift at aspect=${aspect}`);
  }
  return result;
}

function withBaseAspectRule<T>(run: () => T): T {
  const rules = FORMAL_SYNTAX_RULES as ProductionRule[];
  if (rules.some((rule) => rule.id === "clause.aspect")) throw new Error("clause.aspect unexpectedly present");
  const index = rules.findIndex((rule) => rule.id === "clause.ba");
  if (index < 0) throw new Error("clause.ba seam missing");
  rules.splice(index, 0, CLAUSE_ASPECT_RULE);
  try {
    return run();
  } finally {
    const restoreIndex = rules.indexOf(CLAUSE_ASPECT_RULE);
    if (restoreIndex < 0) throw new Error("baseline reconstruction lost clause.aspect");
    rules.splice(restoreIndex, 1);
  }
}

function summarize(records: readonly RecordRow[]): Summary {
  let success = 0;
  let aspectExposure = 0;
  const roots = new Map<string, number>();
  const families = new Map<string, number>();
  for (const row of records) {
    if (row.success) success += 1;
    if (row.aspect) aspectExposure += 1;
    if (row.root !== null) increment(roots, row.root);
    if (row.family !== null) increment(families, row.family);
  }
  return {
    sampleCount: records.length,
    success,
    aspectExposure,
    aspectShare: aspectExposure / records.length,
    roots: objectFromCounts(roots),
    families: objectFromCounts(families),
  };
}

function measure(weight: number, count: number): Measurement {
  const activePolicy = policy(weight);
  const records: RecordRow[] = [];
  for (let round = 0; round < count; round += 1) {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: createSeededRandom(`${SEED_NAMESPACE}:${round}`),
      samplingMode: "product-family",
      samplingPolicy: activePolicy,
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 64,
      bounds: PRODUCT_BOUNDS,
    });
    const candidate = result.candidates[0] ?? null;
    const root = candidate?.syntaxRootRuleId ?? null;
    const family = root === null ? null : sentenceConstructionClassification(root)?.family ?? null;
    records.push({
      success: candidate !== null,
      aspect: (candidate?.syntaxProfileIds ?? []).some((id) => aspectProfiles.has(id)),
      root,
      family,
      fallback: result.fallbackReasons.join("\u0000"),
      derivation: candidate?.syntaxDerivationId ?? null,
      text: candidate?.text ?? null,
    });
  }
  return { weight: activePolicy.predicateMarkingPracticeWeights.aspect, records, summary: summarize(records) };
}

function tv(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
  denominator: number,
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let distance = 0;
  for (const key of keys) distance += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  return distance / (2 * denominator);
}

function row(candidate: Measurement, baseline: Summary) {
  return {
    aspectWeight: candidate.weight,
    ordinaryWeight: roundWeight(NEGATION_BOUNDARY - candidate.weight),
    sampleCount: candidate.summary.sampleCount,
    aspectExposure: candidate.summary.aspectExposure,
    aspectShare: candidate.summary.aspectShare,
    targetAspectShare: baseline.aspectShare,
    absoluteError: Math.abs(candidate.summary.aspectShare - baseline.aspectShare),
    rootTv: tv(candidate.summary.roots, baseline.roots, baseline.sampleCount),
    familyTv: tv(candidate.summary.families, baseline.families, baseline.sampleCount),
  };
}

function rank<T extends { readonly absoluteError: number; readonly rootTv: number; readonly aspectWeight: number }>(rows: readonly T[]): T {
  return [...rows].sort((a, b) => a.absoluteError - b.absoluteError
    || a.rootTv - b.rootTv
    || Math.abs(a.aspectWeight - 0.057) - Math.abs(b.aspectWeight - 0.057))[0]!;
}

const baseline = withBaseAspectRule(() => measure(0, FINAL_COUNT));
if (FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.aspect")) throw new Error("baseline rule leaked");

const baselineCoarse = summarize(baseline.records.slice(0, COARSE_COUNT));
const coarse = [0.035, 0.05, 0.065, 0.08, 0.095]
  .map((weight) => measure(weight, COARSE_COUNT));
const coarseRows = coarse.map((candidate) => row(candidate, baselineCoarse));
const coarseBest = rank(coarseRows);

const fineWeights = [...new Set([
  coarseBest.aspectWeight - 0.01,
  coarseBest.aspectWeight - 0.005,
  coarseBest.aspectWeight,
  coarseBest.aspectWeight + 0.005,
  coarseBest.aspectWeight + 0.01,
].map(roundWeight).filter((weight) => weight >= 0 && weight < NEGATION_BOUNDARY))]
  .sort((a, b) => a - b);
const baselineFine = summarize(baseline.records.slice(0, FINE_COUNT));
const fine = fineWeights.map((weight) => measure(weight, FINE_COUNT));
const fineRows = fine.map((candidate) => row(candidate, baselineFine));
const fineBest = rank(fineRows);

const finalCandidate = measure(fineBest.aspectWeight, FINAL_COUNT);
const finalBaseRow = row(finalCandidate, baseline.summary);
let successMismatch = 0;
let aspectChanged = 0;
let baseAspectToNonAspect = 0;
let baseNonAspectToAspect = 0;
let rootChanged = 0;
let familyChanged = 0;
let fallbackChanged = 0;
let derivationChanged = 0;
let textChanged = 0;
for (let i = 0; i < FINAL_COUNT; i += 1) {
  const left = baseline.records[i]!;
  const right = finalCandidate.records[i]!;
  if (left.success !== right.success) successMismatch += 1;
  if (left.aspect !== right.aspect) {
    aspectChanged += 1;
    if (left.aspect) baseAspectToNonAspect += 1;
    else baseNonAspectToAspect += 1;
  }
  if (left.root !== right.root) rootChanged += 1;
  if (left.family !== right.family) familyChanged += 1;
  if (left.fallback !== right.fallback) fallbackChanged += 1;
  if (left.derivation !== right.derivation) derivationChanged += 1;
  if (left.text !== right.text) textChanged += 1;
}

const recommendation = {
  ...finalBaseRow,
  success: finalCandidate.summary.success,
  aspectExposureDelta: finalCandidate.summary.aspectExposure - baseline.summary.aspectExposure,
  successMismatch,
  aspectChanged,
  baseAspectToNonAspect,
  baseNonAspectToAspect,
  rootChanged,
  familyChanged,
  fallbackChanged,
  derivationChanged,
  textChanged,
};

const report = {
  schemaVersion: "aspect-predicate-marking-calibration-fast-v1",
  baseHead: BASE_HEAD,
  implementationHead: IMPLEMENTATION_HEAD,
  seedNamespace: SEED_NAMESPACE,
  exactAspectProfileCount: aspectProfiles.size,
  meter: "candidate contains a selected runtime profile compatible with exact AUX|PART + aspect:marked",
  structuralReferenceFrom260: { sampleCount: 8192, currentAspectExposure: 620, bareDeletionAspectExposure: 200 },
  calibrationSampleCount: FINAL_COUNT,
  baseline: baseline.summary,
  coarseSweep: coarseRows,
  fineSweep: fineRows,
  recommendation,
  note: "Use this 2048-seed run to choose the policy weight; validate the chosen immutable implementation with a separate 8192-seed final A/B before landing.",
};

const md = [
  "# Aspect predicate-marking calibration",
  "",
  `- Reconstructed #259 baseline: **${baseline.summary.aspectExposure}/${FINAL_COUNT} (${(baseline.summary.aspectShare * 100).toFixed(3)}%)**`,
  `- Recommended aspect ticket: **${(recommendation.aspectWeight * 100).toFixed(2)}%**`,
  `- Recommended ordinary ticket: **${(recommendation.ordinaryWeight * 100).toFixed(2)}%**`,
  `- Negation remains **5.70%** with boundary \`ticketUnit >= 0.943\``,
  `- Candidate exposure: **${recommendation.aspectExposure}/${FINAL_COUNT} (${(recommendation.aspectShare * 100).toFixed(3)}%)**`,
  `- Exposure delta: **${recommendation.aspectExposureDelta >= 0 ? "+" : ""}${recommendation.aspectExposureDelta}**`,
  `- Root TV: **${(recommendation.rootTv * 100).toFixed(3)}%**`,
  `- Family TV: **${(recommendation.familyTv * 100).toFixed(3)}%**`,
  `- Success mismatch: **${recommendation.successMismatch}/${FINAL_COUNT}**`,
  "",
  "This 2,048-seed run chooses the weight only. A separate 8,192-seed immutable-head A/B is still required before landing.",
  "",
].join("\n");

writeFileSync("aspect-calibration.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync("aspect-calibration.md", md, "utf8");
console.log(`aspect-predicate-marking-calibration-fast ${JSON.stringify(report)}`);
