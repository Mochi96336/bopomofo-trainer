import { readFileSync, writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";

const SAMPLE_COUNT = 2048;
const SEED_NAMESPACE = "clausal-subject-prototype-distribution-v1";
const BASE_HEAD = "4c4eaff5aec7d57a3e1a876409bfebaf173ebed2";
const PROTOTYPE_HEAD = "9fc98192705d39157b080a4fe0701979c89f3e8e";
const STRUCTURAL_CLAUSAL_SUBJECT_RULE = "argument.subject.clause";
const LEGACY_SUBJECT_CONTENT_RULE = "clause.subject-content";

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

interface AuditedCandidate {
  readonly syntaxRootRuleId?: string;
  readonly syntaxDerivationId?: string;
  readonly syntaxProfileIds?: readonly string[];
  readonly text: string;
  readonly __auditProductionRulePath?: readonly string[];
}

interface Row {
  readonly success: boolean;
  readonly structuralClausalSubject: boolean;
  readonly legacySubjectContent: boolean;
  readonly anySubjectContent: boolean;
  readonly root: string | null;
  readonly family: string | null;
  readonly rootClauseRule: string | null;
  readonly fallback: string;
  readonly derivation: string | null;
  readonly text: string | null;
  readonly profiles: string;
  readonly path: string;
}

interface Measurement {
  readonly label: string;
  readonly rows: readonly Row[];
  readonly summary: ReturnType<typeof summarize>;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sorted(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
}

function firstClauseRule(path: readonly string[]): string | null {
  return path.find((id) => id.startsWith("clause.")) ?? null;
}

function measure(): Row[] {
  const rows: Row[] = [];
  for (let round = 0; round < SAMPLE_COUNT; round += 1) {
    const composition = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: createSeededRandom(`${SEED_NAMESPACE}:${round}`),
      samplingMode: "product-family",
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 64,
      bounds: PRODUCT_BOUNDS,
    });
    const candidate = (composition.candidates[0] ?? null) as AuditedCandidate | null;
    const path = candidate?.__auditProductionRulePath ?? [];
    const root = candidate?.syntaxRootRuleId ?? null;
    const structuralClausalSubject = path.includes(STRUCTURAL_CLAUSAL_SUBJECT_RULE);
    const legacySubjectContent = path.includes(LEGACY_SUBJECT_CONTENT_RULE);
    rows.push({
      success: candidate !== null,
      structuralClausalSubject,
      legacySubjectContent,
      anySubjectContent: structuralClausalSubject || legacySubjectContent,
      root,
      family: root === null ? null : sentenceConstructionClassification(root)?.family ?? null,
      rootClauseRule: firstClauseRule(path),
      fallback: composition.fallbackReasons.join("\u0000"),
      derivation: candidate?.syntaxDerivationId ?? null,
      text: candidate?.text ?? null,
      profiles: (candidate?.syntaxProfileIds ?? []).join("\u0000"),
      path: path.join("\u0000"),
    });
  }
  return rows;
}

function summarize(rows: readonly Row[]) {
  let success = 0;
  let structuralClausalSubjectExposure = 0;
  let legacySubjectContentExposure = 0;
  let anySubjectContentExposure = 0;
  const roots = new Map<string, number>();
  const families = new Map<string, number>();
  const rootClauseRules = new Map<string, number>();
  const fallbacks = new Map<string, number>();
  const examples: string[] = [];

  for (const row of rows) {
    if (row.success) success += 1;
    if (row.structuralClausalSubject) structuralClausalSubjectExposure += 1;
    if (row.legacySubjectContent) legacySubjectContentExposure += 1;
    if (row.anySubjectContent) {
      anySubjectContentExposure += 1;
      if (row.text !== null && examples.length < 16) examples.push(row.text);
    }
    if (row.root !== null) increment(roots, row.root);
    if (row.family !== null) increment(families, row.family);
    if (row.rootClauseRule !== null) increment(rootClauseRules, row.rootClauseRule);
    if (row.fallback !== "") {
      for (const reason of row.fallback.split("\u0000")) increment(fallbacks, reason);
    }
  }

  return {
    success,
    structuralClausalSubjectExposure,
    legacySubjectContentExposure,
    anySubjectContentExposure,
    anySubjectContentShare: anySubjectContentExposure / SAMPLE_COUNT,
    roots: sorted(roots),
    families: sorted(families),
    rootClauseRules: sorted(rootClauseRules),
    fallbacks: sorted(fallbacks),
    examples,
  };
}

function totalVariation(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let total = 0;
  for (const key of keys) total += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  return total / (2 * SAMPLE_COUNT);
}

function compare(current: Measurement, legacy: Measurement): void {
  if (current.rows.length !== SAMPLE_COUNT || legacy.rows.length !== SAMPLE_COUNT) {
    throw new Error("clausal-subject audit measurement has unexpected seed count");
  }

  const drift = {
    successDeltaLegacyMinusCurrent: legacy.summary.success - current.summary.success,
    rootTv: totalVariation(current.summary.roots, legacy.summary.roots),
    familyTv: totalVariation(current.summary.families, legacy.summary.families),
    rootClauseRuleTv: totalVariation(current.summary.rootClauseRules, legacy.summary.rootClauseRules),
    successMismatch: 0,
    rootChanged: 0,
    familyChanged: 0,
    rootClauseRuleChanged: 0,
    fallbackChanged: 0,
    derivationChanged: 0,
    textChanged: 0,
    profilesChanged: 0,
    pathChanged: 0,
  };

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const left = current.rows[index]!;
    const right = legacy.rows[index]!;
    if (left.success !== right.success) drift.successMismatch += 1;
    if (left.root !== right.root) drift.rootChanged += 1;
    if (left.family !== right.family) drift.familyChanged += 1;
    if (left.rootClauseRule !== right.rootClauseRule) drift.rootClauseRuleChanged += 1;
    if (left.fallback !== right.fallback) drift.fallbackChanged += 1;
    if (left.derivation !== right.derivation) drift.derivationChanged += 1;
    if (left.text !== right.text) drift.textChanged += 1;
    if (left.profiles !== right.profiles) drift.profilesChanged += 1;
    if (left.path !== right.path) drift.pathChanged += 1;
  }

  const report = {
    schemaVersion: "clausal-subject-prototype-distribution-audit-v1",
    baseHead: BASE_HEAD,
    prototypeHead: PROTOTYPE_HEAD,
    sampleCount: SAMPLE_COUNT,
    seedNamespace: SEED_NAMESPACE,
    productBounds: PRODUCT_BOUNDS,
    current: current.summary,
    legacy: legacy.summary,
    drift,
    caveat: "Current product maximumClauseNesting is 1; both legacy and structural clausal-subject paths require deeper recursive expansion.",
  };

  const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;
  const markdown = [
    "# Clausal Subject prototype distribution audit",
    "",
    `- Production base: \`${BASE_HEAD}\``,
    `- Prototype head: \`${PROTOTYPE_HEAD}\``,
    `- Seeds: **${SAMPLE_COUNT}**`,
    `- Product maximumClauseNesting: **${PRODUCT_BOUNDS.maximumClauseNesting}**`,
    `- Current success: **${current.summary.success}/${SAMPLE_COUNT}**`,
    `- Legacy success: **${legacy.summary.success}/${SAMPLE_COUNT}**`,
    `- Current structural clausal Subject exposure: **${current.summary.structuralClausalSubjectExposure}/${SAMPLE_COUNT}**`,
    `- Current legacy subject-content exposure: **${current.summary.legacySubjectContentExposure}/${SAMPLE_COUNT}**`,
    `- Legacy subject-content exposure: **${legacy.summary.legacySubjectContentExposure}/${SAMPLE_COUNT}**`,
    `- Aggregate TV: roots **${pct(drift.rootTv)}**, families **${pct(drift.familyTv)}**, first Clause rules **${pct(drift.rootClauseRuleTv)}**`,
    `- Per-seed changes: success **${drift.successMismatch}**, root **${drift.rootChanged}**, family **${drift.familyChanged}**, first Clause rule **${drift.rootClauseRuleChanged}**, fallback **${drift.fallbackChanged}**, derivation **${drift.derivationChanged}**, path **${drift.pathChanged}**, text **${drift.textChanged}**, profiles **${drift.profilesChanged}**`,
    "",
    "This is a product-distribution audit, not a corpus-frequency claim.",
  ].join("\n");

  writeFileSync("clausal-subject-prototype-distribution-audit.json", `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync("clausal-subject-prototype-distribution-audit.md", `${markdown}\n`);
  console.log(markdown);
  console.log(JSON.stringify(report));
}

const mode = process.argv[2];
if (mode === "--measure") {
  const label = process.argv[3];
  const output = process.argv[4];
  if (label === undefined || output === undefined) {
    throw new Error("--measure requires label and output");
  }
  const rows = measure();
  const measurement: Measurement = { label, rows, summary: summarize(rows) };
  writeFileSync(output, `${JSON.stringify(measurement)}\n`);
  console.log(JSON.stringify({ label, ...measurement.summary }));
} else if (mode === "--compare") {
  const currentPath = process.argv[3];
  const legacyPath = process.argv[4];
  if (currentPath === undefined || legacyPath === undefined) {
    throw new Error("--compare requires current and legacy measurement paths");
  }
  compare(
    JSON.parse(readFileSync(currentPath, "utf8")) as Measurement,
    JSON.parse(readFileSync(legacyPath, "utf8")) as Measurement,
  );
} else {
  throw new Error("use --measure <label> <output> or --compare <current.json> <legacy.json>");
}
