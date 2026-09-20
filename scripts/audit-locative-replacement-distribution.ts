import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import type {
  ProductionConstituent,
  ProductionRule,
} from "../src/syntax/types.js";

const SAMPLE_COUNT = 2048;
const SEED_NAMESPACE = "locative-replacement-distribution-v1";
const BASE_HEAD = "9be9fd260bf733b4d567fde0810a43ec121cd201";
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
  readonly success: number;
  readonly locativeRuleExposure: number;
  readonly locativeRuleShare: number;
  readonly roots: Readonly<Record<string, number>>;
  readonly sentenceFamilies: Readonly<Record<string, number>>;
  readonly rootClauseRules: Readonly<Record<string, number>>;
  readonly fallbacks: Readonly<Record<string, number>>;
  readonly locativeExamples: readonly string[];
}

function constituent(
  key: string,
  category: ProductionConstituent["category"],
  options: Partial<Pick<
    ProductionConstituent,
    "allowedUpos" | "requiredFunctions" | "requiredValencyFrames" | "requiredFeatures"
  >> = {},
): ProductionConstituent {
  return {
    key,
    category,
    minimum: 1,
    maximum: 1,
    recursive: false,
    allowedUpos: options.allowedUpos ?? [],
    requiredFunctions: options.requiredFunctions ?? [],
    requiredValencyFrames: options.requiredValencyFrames ?? [],
    requiredFeatures: options.requiredFeatures ?? {},
  };
}

function legacyLocativeRule(current: ProductionRule): ProductionRule {
  const constituents: readonly ProductionConstituent[] = [
    constituent("subject", "Subject"),
    constituent("copula", "Lexeme", {
      allowedUpos: ["AUX", "VERB"],
      requiredFunctions: ["copula"],
    }),
    constituent("location", "AdpositionPhrase", {
      requiredFunctions: ["oblique"],
    }),
  ];
  return {
    ...current,
    constituents,
    surfaceOrders: [{
      id: "canonical",
      constituentKeys: ["subject", "copula", "location"],
    }],
  };
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

function measure(): readonly Row[] {
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
      sentenceFamily: root === null
        ? null
        : sentenceConstructionClassification(root)?.family ?? null,
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
  const locativeExamples: string[] = [];
  for (const row of rows) {
    if (row.success) success += 1;
    if (row.locativeRule) {
      locativeRuleExposure += 1;
      if (row.text !== null && locativeExamples.length < 12) locativeExamples.push(row.text);
    }
    if (row.root !== null) increment(roots, row.root);
    if (row.sentenceFamily !== null) increment(sentenceFamilies, row.sentenceFamily);
    if (row.rootClauseRule !== null) increment(rootClauseRules, row.rootClauseRule);
    if (row.fallback !== "") {
      for (const reason of row.fallback.split("\u0000")) increment(fallbacks, reason);
    }
  }
  return {
    success,
    locativeRuleExposure,
    locativeRuleShare: locativeRuleExposure / SAMPLE_COUNT,
    roots: sorted(roots),
    sentenceFamilies: sorted(sentenceFamilies),
    rootClauseRules: sorted(rootClauseRules),
    fallbacks: sorted(fallbacks),
    locativeExamples,
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
const locativeIndex = mutableRules.findIndex((rule) => rule.id === LOCATIVE_RULE);
if (locativeIndex < 0) throw new Error(`${LOCATIVE_RULE} missing from current grammar`);
const currentLocative = mutableRules[locativeIndex]!;
if (!currentLocative.constituents.some((item) =>
  item.requiredOccurrenceCapabilities?.includes(
    "verbal-locative-root-subject-object-same-occurrence",
  ) ?? false
)) {
  throw new Error("current locative rule is not the reviewed verbal replacement");
}
const legacyLocative = legacyLocativeRule(currentLocative);

const currentRows = measure();
mutableRules[locativeIndex] = legacyLocative;
let legacyRows: readonly Row[];
try {
  legacyRows = measure();
} finally {
  mutableRules[locativeIndex] = currentLocative;
}

const current = summarize(currentRows);
const legacy = summarize(legacyRows);

const drift = {
  successDeltaLegacyMinusCurrent: legacy.success - current.success,
  rootTv: totalVariation(current.roots, legacy.roots),
  sentenceFamilyTv: totalVariation(current.sentenceFamilies, legacy.sentenceFamilies),
  rootClauseRuleTv: totalVariation(current.rootClauseRules, legacy.rootClauseRules),
  successMismatch: 0,
  rootChanged: 0,
  sentenceFamilyChanged: 0,
  rootClauseRuleChanged: 0,
  fallbackChanged: 0,
  derivationChanged: 0,
  textChanged: 0,
  profilesChanged: 0,
  pathChanged: 0,
};

for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const left = currentRows[index]!;
  const right = legacyRows[index]!;
  if (left.success !== right.success) drift.successMismatch += 1;
  if (left.root !== right.root) drift.rootChanged += 1;
  if (left.sentenceFamily !== right.sentenceFamily) drift.sentenceFamilyChanged += 1;
  if (left.rootClauseRule !== right.rootClauseRule) drift.rootClauseRuleChanged += 1;
  if (left.fallback !== right.fallback) drift.fallbackChanged += 1;
  if (left.derivation !== right.derivation) drift.derivationChanged += 1;
  if (left.text !== right.text) drift.textChanged += 1;
  if (left.profiles !== right.profiles) drift.profilesChanged += 1;
  if (left.path !== right.path) drift.pathChanged += 1;
}

const report = {
  schemaVersion: "locative-replacement-distribution-audit-v1",
  baseHead: BASE_HEAD,
  sampleCount: SAMPLE_COUNT,
  seedNamespace: SEED_NAMESPACE,
  current,
  legacy,
  drift,
  caveat: "This compares executable product behavior under identical deterministic seeds. It is not a natural-language frequency estimate.",
};

const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;
const markdown = [
  "# Locative replacement distribution audit",
  "",
  `- Base main: \`${BASE_HEAD}\``,
  `- Seeds: **${SAMPLE_COUNT}**`,
  `- Current verbal-locative success: **${current.success}/${SAMPLE_COUNT}**`,
  `- Legacy copula+ADP success: **${legacy.success}/${SAMPLE_COUNT}**`,
  `- Current locative exposure: **${current.locativeRuleExposure}/${SAMPLE_COUNT} (${pct(current.locativeRuleShare)})**`,
  `- Legacy locative exposure: **${legacy.locativeRuleExposure}/${SAMPLE_COUNT} (${pct(legacy.locativeRuleShare)})**`,
  `- Aggregate TV current↔legacy: roots **${pct(drift.rootTv)}**, Sentence families **${pct(drift.sentenceFamilyTv)}**, first Clause rules **${pct(drift.rootClauseRuleTv)}**`,
  `- Per-seed changes: success **${drift.successMismatch}**, root **${drift.rootChanged}**, Sentence family **${drift.sentenceFamilyChanged}**, first Clause rule **${drift.rootClauseRuleChanged}**, fallback **${drift.fallbackChanged}**, derivation **${drift.derivationChanged}**, path **${drift.pathChanged}**, text **${drift.textChanged}**, profiles **${drift.profilesChanged}**`,
  "",
  `- Current locative examples: ${current.locativeExamples.map((text) => `\`${text}\``).join(", ")}`,
  `- Legacy locative examples: ${legacy.locativeExamples.map((text) => `\`${text}\``).join(", ")}`,
  "",
  "Product distribution only; not a corpus-frequency claim.",
].join("\n");

writeFileSync("locative-replacement-distribution-audit.json", `${JSON.stringify(report, null, 2)}\n`);
writeFileSync("locative-replacement-distribution-audit.md", `${markdown}\n`);
console.log(markdown);
console.log(JSON.stringify(report));
