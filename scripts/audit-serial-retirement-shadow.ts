import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import type { ProductionRule } from "../src/syntax/types.js";

const SAMPLE_COUNT = 2048;
const SEED_NAMESPACE = "serial-retirement-shadow-v1";
const BASE_HEAD = "567169d2f507f716e56fdebf0efd18d3dcf6dc54";
const SERIAL_RULE = "clause.serial-verb";

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
  readonly serialRule: boolean;
  readonly root: string | null;
  readonly family: string | null;
  readonly rootClauseRule: string | null;
  readonly fallback: string;
  readonly derivation: string | null;
  readonly text: string | null;
  readonly profiles: string;
  readonly path: string;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
function sorted(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
}
function rootClauseRule(path: readonly string[]): string | null {
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
    rows.push({
      success: candidate !== null,
      serialRule: path.includes(SERIAL_RULE),
      root,
      family: root === null ? null : sentenceConstructionClassification(root)?.family ?? null,
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

function summarize(rows: readonly Row[]) {
  let success = 0;
  let serialRuleExposure = 0;
  const roots = new Map<string, number>();
  const families = new Map<string, number>();
  const rootClauseRules = new Map<string, number>();
  const fallbacks = new Map<string, number>();
  for (const row of rows) {
    if (row.success) success += 1;
    if (row.serialRule) serialRuleExposure += 1;
    if (row.root !== null) increment(roots, row.root);
    if (row.family !== null) increment(families, row.family);
    if (row.rootClauseRule !== null) increment(rootClauseRules, row.rootClauseRule);
    if (row.fallback !== "") {
      for (const reason of row.fallback.split("\u0000")) increment(fallbacks, reason);
    }
  }
  return {
    success,
    serialRuleExposure,
    roots: sorted(roots),
    families: sorted(families),
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

const mutableRules = FORMAL_SYNTAX_RULES as ProductionRule[];
const index = mutableRules.findIndex((rule) => rule.id === SERIAL_RULE);
if (index < 0) throw new Error(`${SERIAL_RULE} missing from exact production base`);

const currentRows = measure();
const [removed] = mutableRules.splice(index, 1);
if (removed === undefined) throw new Error(`failed to shadow-remove ${SERIAL_RULE}`);
let shadowRows: Row[];
try {
  shadowRows = measure();
} finally {
  mutableRules.splice(index, 0, removed);
}

const current = summarize(currentRows);
const shadow = summarize(shadowRows);
let successMismatch = 0;
let rootChanged = 0;
let familyChanged = 0;
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
  if (left.root !== right.root) rootChanged += 1;
  if (left.family !== right.family) familyChanged += 1;
  if (left.rootClauseRule !== right.rootClauseRule) rootClauseRuleChanged += 1;
  if (left.fallback !== right.fallback) fallbackChanged += 1;
  if (left.derivation !== right.derivation) derivationChanged += 1;
  if (left.text !== right.text) textChanged += 1;
  if (left.profiles !== right.profiles) profilesChanged += 1;
  if (left.path !== right.path) pathChanged += 1;
}

const report = {
  schemaVersion: "serial-retirement-shadow-audit-v1",
  baseHead: BASE_HEAD,
  sampleCount: SAMPLE_COUNT,
  seedNamespace: SEED_NAMESPACE,
  removedRuleId: SERIAL_RULE,
  current,
  shadow,
  drift: {
    successDelta: shadow.success - current.success,
    rootTv: totalVariation(current.roots, shadow.roots),
    familyTv: totalVariation(current.families, shadow.families),
    rootClauseRuleTv: totalVariation(current.rootClauseRules, shadow.rootClauseRules),
    successMismatch,
    rootChanged,
    familyChanged,
    rootClauseRuleChanged,
    fallbackChanged,
    derivationChanged,
    textChanged,
    profilesChanged,
    pathChanged,
  },
};

const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;
const markdown = [
  "# Generic serial-verb retirement shadow audit",
  "",
  `- Base main: \`${BASE_HEAD}\``,
  `- Seeds: **${SAMPLE_COUNT}** (\`${SEED_NAMESPACE}\`)`,
  `- Current success: **${current.success}/${SAMPLE_COUNT}**`,
  `- Current explicit \`clause.serial-verb\` exposure: **${current.serialRuleExposure}/${SAMPLE_COUNT}**`,
  `- Shadow success: **${shadow.success}/${SAMPLE_COUNT}** (delta ${report.drift.successDelta >= 0 ? "+" : ""}${report.drift.successDelta})`,
  `- Aggregate TV: roots **${pct(report.drift.rootTv)}**, families **${pct(report.drift.familyTv)}**, root Clause rules **${pct(report.drift.rootClauseRuleTv)}**`,
  `- Per-seed changes: success **${successMismatch}**, root **${rootChanged}**, family **${familyChanged}**, root Clause rule **${rootClauseRuleChanged}**, fallback **${fallbackChanged}**, derivation **${derivationChanged}**, path **${pathChanged}**, text **${textChanged}**, profiles **${profilesChanged}**`,
  "",
  "This measures product dependence on the fail-closed generic serial rule; it does not estimate natural Mandarin serial-predicate frequency.",
].join("\n");

writeFileSync("serial-retirement-shadow-audit.json", `${JSON.stringify(report, null, 2)}\n`);
writeFileSync("serial-retirement-shadow-audit.md", `${markdown}\n`);
console.log(markdown);
console.log(JSON.stringify(report));
