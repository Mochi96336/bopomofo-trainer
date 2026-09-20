import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import type { ProductionRule } from "../src/syntax/types.js";

const SAMPLE_COUNT = 2048;
const SEED_NAMESPACE = "locative-retirement-shadow-v1";
const BASE_HEAD = "ed0c920aa26adc276a77ad5bf70224ce049de2a2";
const LOCATIVE_RULE = "clause.locative";

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
  readonly locativeRule: boolean;
  readonly root: string | null;
  readonly sentenceFamily: string | null;
  readonly rootClauseRule: string | null;
  readonly fallback: string;
  readonly derivation: string | null;
  readonly text: string | null;
  readonly profiles: string;
  readonly path: string;
}

interface Summary {
  readonly sampleCount: number;
  readonly success: number;
  readonly locativeRuleExposure: number;
  readonly locativeRuleShareOfAllSeeds: number;
  readonly locativeRuleShareOfSuccesses: number;
  readonly roots: Readonly<Record<string, number>>;
  readonly sentenceFamilies: Readonly<Record<string, number>>;
  readonly rootClauseRules: Readonly<Record<string, number>>;
  readonly fallbacks: Readonly<Record<string, number>>;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sorted(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function rootClauseRule(path: readonly string[]): string | null {
  return path.find((ruleId) => ruleId.startsWith("clause.")) ?? null;
}

const mutableRules = FORMAL_SYNTAX_RULES as ProductionRule[];
if (!mutableRules.some((rule) => rule.id === LOCATIVE_RULE)) {
  throw new Error(`${LOCATIVE_RULE} missing from exact production base`);
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
    rows.push({
      success: candidate !== null,
      locativeRule: path.includes(LOCATIVE_RULE),
      root,
      sentenceFamily: root === null ? null : sentenceConstructionClassification(root)?.family ?? null,
      rootClauseRule: rootClauseRule(path),
      fallback: composition.fallbackReasons.join("\u0000"),
      derivation: candidate?.syntaxDerivationId ?? null,
      text: candidate?.text ?? null,
      profiles: (candidate?.syntaxProfileIds ?? []).join("\u0000"),
      path: path.join("\u0000"),
    });
  }
  return rows;
}

function summarize(rows: readonly Row[]): Summary {
  let success = 0;
  let locativeRuleExposure = 0;
  const roots = new Map<string, number>();
  const sentenceFamilies = new Map<string, number>();
  const rootClauseRules = new Map<string, number>();
  const fallbacks = new Map<string, number>();

  for (const row of rows) {
    if (row.success) success += 1;
    if (row.locativeRule) locativeRuleExposure += 1;
    if (row.root !== null) increment(roots, row.root);
    if (row.sentenceFamily !== null) increment(sentenceFamilies, row.sentenceFamily);
    if (row.rootClauseRule !== null) increment(rootClauseRules, row.rootClauseRule);
    if (row.fallback !== "") {
      for (const reason of row.fallback.split("\u0000")) increment(fallbacks, reason);
    }
  }

  return {
    sampleCount: rows.length,
    success,
    locativeRuleExposure,
    locativeRuleShareOfAllSeeds: locativeRuleExposure / rows.length,
    locativeRuleShareOfSuccesses: success === 0 ? 0 : locativeRuleExposure / success,
    roots: sorted(roots),
    sentenceFamilies: sorted(sentenceFamilies),
    rootClauseRules: sorted(rootClauseRules),
    fallbacks: sorted(fallbacks),
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

function withLocativeRemoved(fn: () => Row[]): Row[] {
  const index = mutableRules.findIndex((rule) => rule.id === LOCATIVE_RULE);
  if (index < 0) throw new Error(`cannot shadow-remove ${LOCATIVE_RULE}`);
  const [removed] = mutableRules.splice(index, 1);
  if (removed === undefined) throw new Error(`failed to remove ${LOCATIVE_RULE}`);
  try {
    return fn();
  } finally {
    mutableRules.splice(index, 0, removed);
  }
}

const currentRows = measure();
const shadowRows = withLocativeRemoved(measure);
const current = summarize(currentRows);
const shadow = summarize(shadowRows);

let successMismatch = 0;
let locativeExposureChanged = 0;
let rootChanged = 0;
let sentenceFamilyChanged = 0;
let rootClauseRuleChanged = 0;
let fallbackChanged = 0;
let derivationChanged = 0;
let textChanged = 0;
let profilesChanged = 0;
let pathChanged = 0;

for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const left = currentRows[index]!;
  const right = shadowRows[index]!;
  if (left.success !== right.success) successMismatch += 1;
  if (left.locativeRule !== right.locativeRule) locativeExposureChanged += 1;
  if (left.root !== right.root) rootChanged += 1;
  if (left.sentenceFamily !== right.sentenceFamily) sentenceFamilyChanged += 1;
  if (left.rootClauseRule !== right.rootClauseRule) rootClauseRuleChanged += 1;
  if (left.fallback !== right.fallback) fallbackChanged += 1;
  if (left.derivation !== right.derivation) derivationChanged += 1;
  if (left.text !== right.text) textChanged += 1;
  if (left.profiles !== right.profiles) profilesChanged += 1;
  if (left.path !== right.path) pathChanged += 1;
}

const drift = {
  successDelta: shadow.success - current.success,
  rootTv: totalVariation(current.roots, shadow.roots),
  sentenceFamilyTv: totalVariation(current.sentenceFamilies, shadow.sentenceFamilies),
  rootClauseRuleTv: totalVariation(current.rootClauseRules, shadow.rootClauseRules),
  successMismatch,
  locativeExposureChanged,
  rootChanged,
  sentenceFamilyChanged,
  rootClauseRuleChanged,
  fallbackChanged,
  derivationChanged,
  textChanged,
  profilesChanged,
  pathChanged,
};

const report = {
  schemaVersion: "locative-retirement-shadow-audit-v1",
  baseHead: BASE_HEAD,
  sampleCount: SAMPLE_COUNT,
  seedNamespace: SEED_NAMESPACE,
  removedRuleId: LOCATIVE_RULE,
  caveat: "clause.locative exposure counts executable legacy-rule use under the current product composer; it is not a corpus or natural-Mandarin frequency estimate",
  current,
  shadow,
  drift,
};

const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;
const markdown = [
  "# Legacy locative retirement shadow audit",
  "",
  `- Base main: \`${BASE_HEAD}\``,
  `- Seeds: **${SAMPLE_COUNT}** (\`${SEED_NAMESPACE}\`)`,
  `- Current success: **${current.success}/${SAMPLE_COUNT}**`,
  `- Current explicit \`clause.locative\` exposure: **${current.locativeRuleExposure}/${SAMPLE_COUNT} (${pct(current.locativeRuleShareOfAllSeeds)})**; **${pct(current.locativeRuleShareOfSuccesses)}** of successful candidates`,
  `- Shadow success: **${shadow.success}/${SAMPLE_COUNT}** (delta ${drift.successDelta >= 0 ? "+" : ""}${drift.successDelta})`,
  `- Aggregate TV: roots **${pct(drift.rootTv)}**, Sentence families **${pct(drift.sentenceFamilyTv)}**, root Clause rules **${pct(drift.rootClauseRuleTv)}**`,
  `- Per-seed changes: success **${successMismatch}**, root **${rootChanged}**, Sentence family **${sentenceFamilyChanged}**, root Clause rule **${rootClauseRuleChanged}**, fallback **${fallbackChanged}**, derivation **${derivationChanged}**, path **${pathChanged}**, text **${textChanged}**, profiles **${profilesChanged}**`,
  "",
  "This measures current executable product dependence only. It does not claim that the legacy rule corresponds to a natural Mandarin locative frequency.",
].join("\n");

writeFileSync("locative-retirement-shadow-audit.json", `${JSON.stringify(report, null, 2)}\n`);
writeFileSync("locative-retirement-shadow-audit.md", `${markdown}\n`);
console.log(markdown);
console.log(JSON.stringify(report));
