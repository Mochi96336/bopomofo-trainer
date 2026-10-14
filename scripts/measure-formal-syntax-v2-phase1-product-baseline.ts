import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";

const PHASE1_CLOSURE_COMMIT = "b77e2bc643baaa91fdd9fb42df14cbfcdffd4e5f";
const SAMPLE_COUNT = 2048;
const SEED_NAMESPACE = "formal-syntax-v2-phase1-product-baseline-v1";

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
  readonly root: string | null;
  readonly family: string | null;
  readonly firstClauseRule: string | null;
  readonly fallback: string;
  readonly derivation: string | null;
  readonly path: string;
  readonly text: string | null;
  readonly profiles: string;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedRecord(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function firstClauseRule(path: readonly string[]): string | null {
  return path.find((id) => id.startsWith("clause.")) ?? null;
}

function measureRows(): readonly Row[] {
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
      root,
      family: root === null ? null : sentenceConstructionClassification(root)?.family ?? null,
      firstClauseRule: firstClauseRule(path),
      fallback: composition.fallbackReasons.join("\u0000"),
      derivation: candidate?.syntaxDerivationId ?? null,
      path: path.join("\u0000"),
      text: candidate?.text ?? null,
      profiles: (candidate?.syntaxProfileIds ?? []).join("\u0000"),
    });
  }
  return rows;
}

function baseline(rows: readonly Row[]) {
  let success = 0;
  const roots = new Map<string, number>();
  const families = new Map<string, number>();
  const firstClauseRules = new Map<string, number>();
  const fallbacks = new Map<string, number>();

  for (const row of rows) {
    if (row.success) success += 1;
    if (row.root !== null) increment(roots, row.root);
    if (row.family !== null) increment(families, row.family);
    if (row.firstClauseRule !== null) increment(firstClauseRules, row.firstClauseRule);
    if (row.fallback !== "") {
      for (const reason of row.fallback.split("\u0000")) increment(fallbacks, reason);
    }
  }

  const rowProjection = rows.map((row, seedIndex) => ({ seedIndex, ...row }));
  return {
    schemaVersion: "formal-syntax-v2-phase1-product-baseline-v1",
    phase1ClosureCommit: PHASE1_CLOSURE_COMMIT,
    sampleCount: SAMPLE_COUNT,
    seedNamespace: SEED_NAMESPACE,
    productBounds: PRODUCT_BOUNDS,
    success,
    failure: SAMPLE_COUNT - success,
    roots: sortedRecord(roots),
    families: sortedRecord(families),
    firstClauseRules: sortedRecord(firstClauseRules),
    fallbacks: sortedRecord(fallbacks),
    rowsDigest: sha256Json(rowProjection),
    textDigest: sha256Json(rows.map((row) => row.text)),
    derivationDigest: sha256Json(rows.map((row) => row.derivation)),
    pathDigest: sha256Json(rows.map((row) => row.path)),
    profileDigest: sha256Json(rows.map((row) => row.profiles)),
  };
}

const mode = process.argv[2];
if (mode === "--measure") {
  const output = process.argv[3];
  if (output === undefined) throw new Error("--measure requires an output path");
  const measured = baseline(measureRows());
  writeFileSync(output, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(JSON.stringify(measured, null, 2));
} else if (mode === "--verify") {
  const expectedPath = process.argv[3];
  if (expectedPath === undefined) throw new Error("--verify requires an expected baseline path");
  const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as unknown;
  const measured = baseline(measureRows());
  if (JSON.stringify(measured) !== JSON.stringify(expected)) {
    throw new Error(
      `Formal Syntax V2 phase-one product baseline drifted.\nExpected: ${JSON.stringify(expected, null, 2)}\nMeasured: ${JSON.stringify(measured, null, 2)}`,
    );
  }
  console.log(JSON.stringify(measured, null, 2));
} else {
  throw new Error("use --measure <output> or --verify <baseline>");
}
