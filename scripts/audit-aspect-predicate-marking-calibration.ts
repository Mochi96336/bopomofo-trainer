import { writeFileSync } from "node:fs";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../src/app/generated/catalog.js";
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
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../src/syntax/realize.js";
import type {
  ProductionConstituent,
  ProductionRule,
  SyntaxCategory,
  SyntaxFeatureSet,
  Upos,
} from "../src/syntax/types.js";

const BASE_HEAD = "4d97bfec67946df620cf8a5d70bc87b704edfa75";
const IMPLEMENTATION_HEAD = "970aa87c7e01ba2b51afe6ee601128c79d5a78f6";
const SEED_NAMESPACE = "aspect-predicate-marking-calibration";
const FULL_SAMPLE_COUNT = 8192;
const COARSE_SAMPLE_COUNT = 1024;
const FINE_SAMPLE_COUNT = 2048;
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

interface SampleRecord {
  readonly round: number;
  readonly success: boolean;
  readonly aspectProfileExposure: boolean;
  readonly rootRuleId: string | null;
  readonly family: string | null;
  readonly fallbackKey: string;
  readonly derivationId: string | null;
  readonly text: string | null;
}

interface MeasurementSummary {
  readonly sampleCount: number;
  readonly success: number;
  readonly aspectProfileExposure: number;
  readonly aspectShareAll: number;
  readonly aspectShareSuccessful: number;
  readonly roots: Readonly<Record<string, number>>;
  readonly families: Readonly<Record<string, number>>;
  readonly fallbackReasons: Readonly<Record<string, number>>;
}

interface Measurement {
  readonly label: string;
  readonly aspectWeight: number;
  readonly summary: MeasurementSummary;
  readonly records: readonly SampleRecord[];
}

interface MeasurementReport {
  readonly schemaVersion: "aspect-predicate-marking-calibration-v1";
  readonly baseHead: string;
  readonly implementationHead: string;
  readonly seedNamespace: string;
  readonly meter: string;
  readonly aspectProfileIds: readonly string[];
  readonly structuralReferenceFrom260: {
    readonly sampleCount: 8192;
    readonly currentAspectExposure: 620;
    readonly bareDeletionAspectExposure: 200;
  };
  readonly baseline: MeasurementSummary;
  readonly coarseSweep: readonly SweepRow[];
  readonly fineSweep: readonly SweepRow[];
  readonly finalRuns: readonly FinalRow[];
  readonly recommendation: FinalRow;
}

interface SweepRow {
  readonly aspectWeight: number;
  readonly ordinaryWeight: number;
  readonly sampleCount: number;
  readonly aspectProfileExposure: number;
  readonly aspectShareAll: number;
  readonly targetAspectShareAll: number;
  readonly absoluteShareError: number;
  readonly rootTv: number;
  readonly familyTv: number;
}

interface FinalRow extends SweepRow {
  readonly success: number;
  readonly aspectExposureDelta: number;
  readonly successMismatch: number;
  readonly aspectClassificationChanged: number;
  readonly baselineAspectToNonAspect: number;
  readonly baselineNonAspectToAspect: number;
  readonly rootChanged: number;
  readonly familyChanged: number;
  readonly fallbackChanged: number;
  readonly derivationChanged: number;
  readonly textChanged: number;
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedObject(counts: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function constituent(
  key: string,
  category: SyntaxCategory,
  options: {
    readonly minimum?: number;
    readonly maximum?: number;
    readonly allowedUpos?: readonly Upos[];
    readonly requiredFunctions?: readonly ("predicate")[];
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
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "aspect", "object"],
  }],
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
const aspectProfileIds = new Set(
  compatibleProfilesForSlot(aspectSlot, profileIndex).map((profile) => profile.id),
);

if (aspectProfileIds.size === 0) {
  throw new Error("aspect calibration requires a non-empty exact aspect lexical frontier");
}

function roundWeight(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function policyForAspectWeight(aspectWeight: number): FormalSyntaxSamplingPolicy {
  if (!(aspectWeight >= 0 && aspectWeight < NEGATION_BOUNDARY)) {
    throw new Error(`invalid aspect weight ${aspectWeight}`);
  }
  const ordinary = roundWeight(NEGATION_BOUNDARY - aspectWeight);
  const policy: FormalSyntaxSamplingPolicy = {
    ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
    version: `aspect-calibration-${aspectWeight.toFixed(4)}`,
    predicateMarkingPracticeWeights: {
      ordinary,
      aspect: aspectWeight,
      negation: NEGATION_WEIGHT,
    },
  };
  const intentBelow = predicateMarkingPracticeIntentForTicketUnit(0.942999999999, policy);
  const intentAt = predicateMarkingPracticeIntentForTicketUnit(NEGATION_BOUNDARY, policy);
  if (intentAt !== "negation" || intentBelow === "negation") {
    throw new Error(`negation boundary drifted under aspect weight ${aspectWeight}`);
  }
  return policy;
}

const baselinePolicy = policyForAspectWeight(0);

function withRestoredClauseAspect<T>(operation: () => T): T {
  const rules = FORMAL_SYNTAX_RULES as ProductionRule[];
  if (rules.some((rule) => rule.id === CLAUSE_ASPECT_RULE.id)) {
    throw new Error("implementation grammar unexpectedly still contains clause.aspect");
  }
  const insertAt = rules.findIndex((rule) => rule.id === "clause.ba");
  if (insertAt < 0) throw new Error("cannot reconstruct #259: clause.ba insertion seam missing");
  rules.splice(insertAt, 0, CLAUSE_ASPECT_RULE);
  try {
    return operation();
  } finally {
    const restoredIndex = rules.findIndex((rule) => rule === CLAUSE_ASPECT_RULE);
    if (restoredIndex < 0) throw new Error("baseline clause.aspect reconstruction was lost");
    rules.splice(restoredIndex, 1);
  }
}

function measure(
  label: string,
  sampleCount: number,
  policy: FormalSyntaxSamplingPolicy,
): Measurement {
  const records: SampleRecord[] = [];
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
    const rootRuleId = candidate?.syntaxRootRuleId ?? null;
    const classification = rootRuleId === null ? null : sentenceConstructionClassification(rootRuleId);
    const candidateProfiles = candidate?.syntaxProfileIds ?? [];
    records.push({
      round,
      success: candidate !== null,
      aspectProfileExposure: candidateProfiles.some((profileId) => aspectProfileIds.has(profileId)),
      rootRuleId,
      family: classification?.family ?? null,
      fallbackKey: composition.fallbackReasons.join("\u0000"),
      derivationId: candidate?.syntaxDerivationId ?? null,
      text: candidate?.text ?? null,
    });
  }
  return {
    label,
    aspectWeight: policy.predicateMarkingPracticeWeights.aspect,
    summary: summarize(records),
    records,
  };
}

function summarize(records: readonly SampleRecord[]): MeasurementSummary {
  let success = 0;
  let aspectProfileExposure = 0;
  const roots = new Map<string, number>();
  const families = new Map<string, number>();
  const fallbackReasons = new Map<string, number>();
  for (const record of records) {
    if (record.success) success += 1;
    if (record.aspectProfileExposure) aspectProfileExposure += 1;
    if (record.rootRuleId !== null) increment(roots, record.rootRuleId);
    if (record.family !== null) increment(families, record.family);
    if (record.fallbackKey !== "") {
      for (const reason of record.fallbackKey.split("\u0000")) increment(fallbackReasons, reason);
    }
  }
  return {
    sampleCount: records.length,
    success,
    aspectProfileExposure,
    aspectShareAll: aspectProfileExposure / records.length,
    aspectShareSuccessful: success === 0 ? 0 : aspectProfileExposure / success,
    roots: sortedObject(roots),
    families: sortedObject(families),
    fallbackReasons: sortedObject(fallbackReasons),
  };
}

function totalVariation(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
  denominator: number,
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let distance = 0;
  for (const key of keys) distance += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  return distance / (2 * denominator);
}

function sweepRow(
  measurement: Measurement,
  baseline: MeasurementSummary,
): SweepRow {
  return {
    aspectWeight: measurement.aspectWeight,
    ordinaryWeight: roundWeight(NEGATION_BOUNDARY - measurement.aspectWeight),
    sampleCount: measurement.summary.sampleCount,
    aspectProfileExposure: measurement.summary.aspectProfileExposure,
    aspectShareAll: measurement.summary.aspectShareAll,
    targetAspectShareAll: baseline.aspectShareAll,
    absoluteShareError: Math.abs(measurement.summary.aspectShareAll - baseline.aspectShareAll),
    rootTv: totalVariation(measurement.summary.roots, baseline.roots, baseline.sampleCount),
    familyTv: totalVariation(measurement.summary.families, baseline.families, baseline.sampleCount),
  };
}

function finalRow(
  measurement: Measurement,
  baseline: Measurement,
): FinalRow {
  if (measurement.records.length !== baseline.records.length) {
    throw new Error("final comparison requires equal seed counts");
  }
  let successMismatch = 0;
  let aspectClassificationChanged = 0;
  let baselineAspectToNonAspect = 0;
  let baselineNonAspectToAspect = 0;
  let rootChanged = 0;
  let familyChanged = 0;
  let fallbackChanged = 0;
  let derivationChanged = 0;
  let textChanged = 0;
  for (let index = 0; index < baseline.records.length; index += 1) {
    const left = baseline.records[index]!;
    const right = measurement.records[index]!;
    if (left.success !== right.success) successMismatch += 1;
    if (left.aspectProfileExposure !== right.aspectProfileExposure) {
      aspectClassificationChanged += 1;
      if (left.aspectProfileExposure) baselineAspectToNonAspect += 1;
      else baselineNonAspectToAspect += 1;
    }
    if (left.rootRuleId !== right.rootRuleId) rootChanged += 1;
    if (left.family !== right.family) familyChanged += 1;
    if (left.fallbackKey !== right.fallbackKey) fallbackChanged += 1;
    if (left.derivationId !== right.derivationId) derivationChanged += 1;
    if (left.text !== right.text) textChanged += 1;
  }
  return {
    ...sweepRow(measurement, baseline.summary),
    success: measurement.summary.success,
    aspectExposureDelta:
      measurement.summary.aspectProfileExposure - baseline.summary.aspectProfileExposure,
    successMismatch,
    aspectClassificationChanged,
    baselineAspectToNonAspect,
    baselineNonAspectToAspect,
    rootChanged,
    familyChanged,
    fallbackChanged,
    derivationChanged,
    textChanged,
  };
}

function compareSweepRows(left: SweepRow, right: SweepRow): number {
  return left.absoluteShareError - right.absoluteShareError
    || left.rootTv - right.rootTv
    || Math.abs(left.aspectWeight - 0.057) - Math.abs(right.aspectWeight - 0.057)
    || left.aspectWeight - right.aspectWeight;
}

function uniqueWeights(values: readonly number[]): readonly number[] {
  return [...new Set(values
    .map(roundWeight)
    .filter((value) => value >= 0 && value < NEGATION_BOUNDARY))]
    .sort((left, right) => left - right);
}

function markdown(report: MeasurementReport): string {
  const baseline = report.baseline;
  const recommended = report.recommendation;
  const lines = [
    "# Aspect predicate-marking calibration",
    "",
    `- Baseline head reconstructed: \`${report.baseHead}\``,
    `- Implementation head: \`${report.implementationHead}\``,
    `- Exact aspect-compatible runtime profiles: **${report.aspectProfileIds.length}**`,
    `- Baseline exposure: **${baseline.aspectProfileExposure}/${baseline.sampleCount} (${(baseline.aspectShareAll * 100).toFixed(3)}%)**`,
    `- Recommended aspect ticket: **${(recommended.aspectWeight * 100).toFixed(2)}%**`,
    `- Recommended ordinary ticket: **${(recommended.ordinaryWeight * 100).toFixed(2)}%**`,
    `- Negation ticket remains: **${(NEGATION_WEIGHT * 100).toFixed(2)}%**, boundary \`ticketUnit >= ${NEGATION_BOUNDARY}\``,
    `- Recommended exposure: **${recommended.aspectProfileExposure}/${recommended.sampleCount} (${(recommended.aspectShareAll * 100).toFixed(3)}%)**`,
    `- Exposure delta: **${recommended.aspectExposureDelta >= 0 ? "+" : ""}${recommended.aspectExposureDelta}**`,
    `- Root TV: **${(recommended.rootTv * 100).toFixed(3)}%**`,
    `- Family TV: **${(recommended.familyTv * 100).toFixed(3)}%**`,
    "",
    "The exposure meter counts realized selected runtime profiles that satisfy the exact `aspect: marked` lexical gate. It is a product lexical-exposure meter, not a claim about natural-language frequency.",
  ];
  return `${lines.join("\n")}\n`;
}

const baselineFull = withRestoredClauseAspect(() =>
  measure("reconstructed-259", FULL_SAMPLE_COUNT, baselinePolicy));

if (FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.aspect")) {
  throw new Error("clause.aspect leaked out of baseline reconstruction");
}

const baselineCoarse = summarize(baselineFull.records.slice(0, COARSE_SAMPLE_COUNT));
const coarseWeights = [0.03, 0.04, 0.05, 0.057, 0.065, 0.075, 0.085];
const coarseMeasurements = coarseWeights.map((weight) =>
  measure(`coarse-${weight}`, COARSE_SAMPLE_COUNT, policyForAspectWeight(weight)));
const coarseRows = coarseMeasurements.map((measurement) => sweepRow(measurement, baselineCoarse));
const coarseBest = [...coarseRows].sort(compareSweepRows)[0]!;

const fineWeights = uniqueWeights([
  coarseBest.aspectWeight - 0.0075,
  coarseBest.aspectWeight - 0.005,
  coarseBest.aspectWeight - 0.0025,
  coarseBest.aspectWeight,
  coarseBest.aspectWeight + 0.0025,
  coarseBest.aspectWeight + 0.005,
  coarseBest.aspectWeight + 0.0075,
]);
const baselineFine = summarize(baselineFull.records.slice(0, FINE_SAMPLE_COUNT));
const fineMeasurements = fineWeights.map((weight) =>
  measure(`fine-${weight}`, FINE_SAMPLE_COUNT, policyForAspectWeight(weight)));
const fineRows = fineMeasurements.map((measurement) => sweepRow(measurement, baselineFine));
const fineBest = [...fineRows].sort(compareSweepRows)[0]!;

const finalMeasurements: Measurement[] = [];
let nextWeight = fineBest.aspectWeight;
for (let pass = 0; pass < 3; pass += 1) {
  if (finalMeasurements.some((measurement) => measurement.aspectWeight === nextWeight)) break;
  const measurement = measure(`final-${pass}-${nextWeight}`, FULL_SAMPLE_COUNT, policyForAspectWeight(nextWeight));
  finalMeasurements.push(measurement);
  const shareDelta = measurement.summary.aspectShareAll - baselineFull.summary.aspectShareAll;
  if (Math.abs(shareDelta) <= 1 / FULL_SAMPLE_COUNT) break;
  const step = Math.max(0.001, Math.min(0.01, Math.abs(shareDelta)));
  nextWeight = roundWeight(nextWeight + (shareDelta < 0 ? step : -step));
  if (!(nextWeight >= 0 && nextWeight < NEGATION_BOUNDARY)) break;
}

const finalRows = finalMeasurements.map((measurement) => finalRow(measurement, baselineFull));
const recommendation = [...finalRows].sort(compareSweepRows)[0]!;

const report: MeasurementReport = {
  schemaVersion: "aspect-predicate-marking-calibration-v1",
  baseHead: BASE_HEAD,
  implementationHead: IMPLEMENTATION_HEAD,
  seedNamespace: SEED_NAMESPACE,
  meter: "candidate contains >=1 selected runtime profile compatible with exact AUX|PART + aspect:marked lexical slot",
  aspectProfileIds: [...aspectProfileIds].sort(),
  structuralReferenceFrom260: {
    sampleCount: 8192,
    currentAspectExposure: 620,
    bareDeletionAspectExposure: 200,
  },
  baseline: baselineFull.summary,
  coarseSweep: coarseRows,
  fineSweep: fineRows,
  finalRuns: finalRows,
  recommendation,
};

writeFileSync("aspect-calibration.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync("aspect-calibration.md", markdown(report), "utf8");
console.log(`aspect-predicate-marking-calibration ${JSON.stringify(report)}`);
