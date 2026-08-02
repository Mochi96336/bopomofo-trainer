import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { applyCommonnessProjection } from "../src/commonness/catalog-projection.js";
import {
  projectNaerActiveCatalogRows,
  type NaerActiveCatalogRowsFile,
} from "../src/commonness/naer-general-frequency.js";
import {
  catalogEntryCommonnessTier,
  commonnessTierThresholds,
} from "../src/commonness/tiers.js";
import type { CatalogEntry } from "../src/core/model.js";
import {
  applyCatalogSyntaxLegalityArtifact,
  type CatalogSyntaxLegalityArtifact,
} from "../src/syntax/catalog-legality.js";
import {
  catalogQaHeaderError,
  csvLine,
  drawStratifiedSample,
  formatAssignedProfiles,
  grammarEvidenceLevel,
  manifestDigest,
  metadataIntegrityDigest,
  sheetDigest,
  type AssignedProfile,
} from "./catalog-qa-core.js";
import { buildColumnReport, renderColumnReport } from "./catalog-qa-report.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

/**
 * Draws a stratified review sample from the shipped catalog.
 *
 * Every entry in the catalog has passed formal validation -- the reading parses,
 * the syllables are legal, the grammar profile satisfies the rule index. None of
 * that says the reading is the one a reader would give the word, or that the
 * grammatical role is the one the word actually has. Those are judgements, and
 * the only way to know the rate at which they are wrong is to look at a sample
 * and count.
 *
 * This draws the sample and this scores it back. It deliberately does not decide
 * anything: the verdicts are typed in by a person, and `--score` only counts
 * them, broken down by stratum. See docs/catalog-sampling-qa.md.
 */

const REVIEW_COLUMNS = ["reading_verdict", "role_verdict", "notes"] as const;
const VERDICTS = ["ok", "wrong", "unsure"] as const;
type Verdict = (typeof VERDICTS)[number];

interface Options {
  readonly mode: "draw" | "score";
  readonly out: string;
  readonly input: string;
  readonly seed: string;
  readonly base: number;
  readonly perLevel: number;
  readonly meta: string | undefined;
  readonly force: boolean;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`--${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function parseOptions(argv: readonly string[]): Options {
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    // A following flag is not this flag's value.
    return value === undefined || value.startsWith("--") ? undefined : value;
  };
  // Mode comes from whether the flag is present, never from whether it was given
  // a value. Deciding it by the value meant `--score` with the path left off
  // fell through to drawing, and drawing writes the default sheet -- so the one
  // command a reviewer would run to score a half-filled sheet could overwrite
  // it with a fresh empty one.
  const mode = argv.includes("--score") ? "score" : "draw";
  const input = flag("score");
  if (mode === "score" && input === undefined) {
    fail("--score needs the path of a filled review sheet, e.g. --score data/qa/catalog-sample.csv");
  }
  return {
    mode,
    out: flag("out") ?? "data/qa/catalog-sample.csv",
    input: input ?? "",
    seed: flag("seed") ?? "catalog-qa-1",
    base: positiveInteger("base", flag("base"), 200),
    perLevel: positiveInteger("per-level", flag("per-level"), 25),
    meta: flag("meta"),
    force: argv.includes("--force"),
  };
}

function sheetHasVerdicts(source: string): boolean {
  const parsed = parseCsv(source.replace(/^﻿/, ""));
  return parsed.records.some(({ values }) =>
    REVIEW_COLUMNS.some((column) => (values[column] ?? "").trim() !== "")
  );
}

interface GrammarProfile {
  readonly entryId: string;
  readonly upos: string;
  readonly valencyFrames?: readonly string[];
  readonly dependencyEvidence?: {
    readonly dependencyRelationCounts?: Readonly<Record<string, number>>;
  };
  readonly provenanceIds?: readonly string[];
}

interface ReadingRow {
  readonly lookupText: string;
  readonly trainerReading: string;
}

interface CedictRow {
  readonly lookupText: string;
  readonly status: string;
}

/** The strata a sampled row is drawn against and scored back by. */
interface Strata {
  /** Which committed projection carries the reading the catalog ships. */
  readonly readingSupport: string;
  /** Whether the catalog ships more than one reading for this text. */
  readonly heteronym: string;
  /** What CC-CEDICT says about the text's identity, which is a heteronym signal. */
  readonly cedict: string;
  readonly commonness: string;
  /** How much dependency evidence stands behind the grammatical role. */
  readonly grammarEvidence: string;
  readonly predicate: string;
}

const STRATUM_NAMES = [
  "readingSupport",
  "heteronym",
  "cedict",
  "commonness",
  "grammarEvidence",
  "predicate",
] as const satisfies readonly (keyof Strata)[];

/** Everything the reviewer must not change, and what the digest covers. */
const FIXED_COLUMNS = [
  "entry_id",
  "text",
  "reading",
  "selection",
  "floor_for",
  "assigned_profiles",
  "profile_count",
  ...STRATUM_NAMES,
] as const;

function readingKey(text: string, reading: string): string {
  return `${text} ${reading}`;
}

/** Observed dependencies behind one profile, which is the unit the level uses. */
function profileEvidence(profile: GrammarProfile): number {
  const counts = profile.dependencyEvidence?.dependencyRelationCounts ?? {};
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

function predicateLevel(profiles: readonly GrammarProfile[]): string {
  if (profiles.length === 0) return "no-profile";
  const frames = profiles.flatMap((profile) => profile.valencyFrames ?? []);
  if (frames.length === 0) return "no-frame";
  return frames.every((frame) => frame === "avalent") ? "non-predicate" : "predicate";
}

/** What the entry was actually assigned, as the reviewer has to see it. */
interface AssignedRole {
  /** Kept per profile rather than as two flattened sets -- see
   * `formatAssignedProfiles` for why the pairing has to survive onto the sheet. */
  readonly profiles: readonly AssignedProfile[];
}

async function loadCatalog(): Promise<{
  readonly entries: readonly CatalogEntry[];
  readonly readings: ReadonlyMap<string, string>;
  readonly strata: ReadonlyMap<string, Strata>;
  readonly roles: ReadonlyMap<string, AssignedRole>;
  readonly digests: Readonly<Record<string, string>>;
}> {
  const [
    resolved,
    provenanceSource,
    commonnessSource,
    legalitySource,
    profilesSource,
    concisedSource,
    revisedSource,
    cedictSource,
    manualSource,
  ] = await Promise.all([
    loadResolvedCatalogSource(),
    readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
    readFile(new URL("../data/commonness/naer-1141208-active-catalog-rows.json", import.meta.url), "utf8"),
    readFile(new URL("../data/grammar/formal-syntax-active-catalog-legality.json", import.meta.url), "utf8"),
    readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
    readFile(new URL("../data/readings/moe-concised-2014_20260626-active-catalog.json", import.meta.url), "utf8"),
    readFile(new URL("../data/readings/moe-revised-2015_20260625-active-catalog-fallback.json", import.meta.url), "utf8"),
    readFile(new URL("../data/identity/cedict-active-catalog-hints.json", import.meta.url), "utf8"),
    readFile(new URL("../data/readings/manual-reading-overrides.json", import.meta.url), "utf8"),
  ]);

  const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
  if (provenance.errors.length > 0) {
    throw new Error(provenance.errors.map((error) => error.message).join("\n"));
  }
  const compiled = compileCatalog(resolved.records, provenance.ids);
  if (compiled.errors.length > 0) {
    throw new Error(compiled.errors.map((error) => `row ${error.rowNumber}: ${error.message}`).join("\n"));
  }

  const commonness = projectNaerActiveCatalogRows(
    JSON.parse(commonnessSource) as NaerActiveCatalogRowsFile,
    compiled.entries,
  );
  const withCommonness = applyCommonnessProjection(compiled.entries, commonness.projection);
  const legalityArtifact = JSON.parse(legalitySource) as CatalogSyntaxLegalityArtifact;
  const legality = applyCatalogSyntaxLegalityArtifact(compiled.entries, legalityArtifact);

  // The shipped catalog, which is the only one worth sampling: entries the
  // legality gate excludes never reach a learner.
  const entries = withCommonness.entries.filter((entry) => legality.legalEntryIds.has(entry.id));
  const thresholds = commonnessTierThresholds(
    entries
      .map((entry) => entry.commonnessBase?.selectionWeight)
      .filter((weight): weight is number => weight !== undefined),
  );

  const profilesFile = JSON.parse(profilesSource) as {
    readonly profiles: readonly GrammarProfile[];
    readonly catalogDigest: string;
    readonly sourceEvidenceDigest: string;
  };
  const profilesByEntry = new Map<string, GrammarProfile[]>();
  for (const profile of profilesFile.profiles) {
    const list = profilesByEntry.get(profile.entryId);
    if (list === undefined) profilesByEntry.set(profile.entryId, [profile]);
    else list.push(profile);
  }

  // Keyed by text as well as by text-and-reading, because "no projection covers
  // this word" and "a projection covers it and gives a different reading" are
  // not the same risk at all, and collapsing them would hide the worse one.
  const projectionTexts = new Set<string>();
  const readingSet = (rows: readonly ReadingRow[]): Set<string> => {
    for (const row of rows) projectionTexts.add(row.lookupText);
    return new Set(rows.map((row) => readingKey(row.lookupText, row.trainerReading)));
  };
  const concised = readingSet(
    (JSON.parse(concisedSource) as { readonly rows: readonly ReadingRow[] }).rows,
  );
  const revised = readingSet(
    (JSON.parse(revisedSource) as { readonly rows: readonly ReadingRow[] }).rows,
  );
  const manualRows = (JSON.parse(manualSource) as {
    readonly rows: readonly { text: string; reading: string }[];
  }).rows;
  for (const row of manualRows) projectionTexts.add(row.text);
  const manual = new Set(manualRows.map((row) => readingKey(row.text, row.reading)));
  const cedictStatus = new Map(
    (JSON.parse(cedictSource) as { readonly rows: readonly CedictRow[] }).rows
      .map((row) => [row.lookupText, row.status] as const),
  );

  // Straight off the source row rather than rebuilt from the compiled syllables:
  // a `Syllable` carries tokens, not the reading text the projections are keyed
  // by, and reconstructing one would be inventing a second spelling of it.
  const readings = new Map<string, string>();
  for (const { values } of resolved.records) {
    const text = values["text"];
    const reading = values["reading"];
    if (text === undefined || reading === undefined) continue;
    // The compiler collapses whitespace to hyphens when it builds the id, so the
    // key is derived the same way and the value stays the spaced form the
    // reading projections are written in.
    readings.set(`word:${text}:${reading.replace(/\s+/gu, "-")}`, reading);
  }

  const readingCounts = new Map<string, number>();
  for (const entry of entries) {
    readingCounts.set(entry.prompt.text, (readingCounts.get(entry.prompt.text) ?? 0) + 1);
  }

  const roles = new Map<string, AssignedRole>();
  for (const entry of entries) {
    const profiles = profilesByEntry.get(entry.id) ?? [];
    roles.set(entry.id, {
      profiles: profiles.map((profile) => ({
        upos: profile.upos,
        frames: profile.valencyFrames ?? [],
        evidence: profileEvidence(profile),
      })),
    });
  }

  const strata = new Map<string, Strata>();
  for (const entry of entries) {
    const text = entry.prompt.text;
    const reading = readings.get(entry.id);
    if (reading === undefined) throw new Error(`no source reading for ${entry.id}`);
    const key = readingKey(text, reading);
    strata.set(entry.id, {
      readingSupport: manual.has(key)
        ? "manual-override"
        : concised.has(key)
          ? "moe-concised"
          : revised.has(key)
            ? "moe-revised-fallback"
            // The word is in a projection, which gives a different reading for
            // it. Whatever chose the shipped one overrode a committed source.
            : projectionTexts.has(text)
              ? "projection-disagrees"
              // Nothing committed covers the word at all, so the reading rests
              // entirely on the generation pipeline.
              : "no-projection",
      heteronym: (readingCounts.get(text) ?? 1) > 1 ? "multi-reading" : "single-reading",
      cedict: cedictStatus.get(text) ?? "absent",
      commonness: `tier-${catalogEntryCommonnessTier(entry, thresholds) ?? "none"}`,
      // Graded on the weakest role, not on the entry's total. `predicate` stays
      // an entry-level question -- whether this word can head a clause is true
      // of the word if it is true of any of its profiles.
      grammarEvidence: grammarEvidenceLevel(roles.get(entry.id)?.profiles ?? []),
      predicate: predicateLevel(profilesByEntry.get(entry.id) ?? []),
    });
  }

  return {
    entries,
    readings,
    strata,
    roles,
    digests: {
      catalog: profilesFile.catalogDigest,
      readingResolution: resolved.report.determinismDigest,
      commonness: commonness.projection.determinismDigest,
      grammarEvidence: profilesFile.sourceEvidenceDigest,
    },
  };
}

async function draw(options: Options): Promise<void> {
  const { entries, readings, strata, roles, digests } = await loadCatalog();
  const sample = drawStratifiedSample(entries, {
    idOf: (entry) => entry.id,
    strataOf: (entry) => strata.get(entry.id) ?? {},
    stratumNames: STRATUM_NAMES,
    seed: options.seed,
    base: options.base,
    perLevel: options.perLevel,
  });

  const rows = [...sample.rows].sort((left, right) => left.id.localeCompare(right.id));
  const header = [...FIXED_COLUMNS, ...REVIEW_COLUMNS];
  const lines = [csvLine(header)];
  const fixedRows: string[][] = [];
  for (const entry of rows) {
    const stratum = strata.get(entry.id);
    if (stratum === undefined) continue;
    const role = roles.get(entry.id);
    const fixed = [
      entry.id,
      entry.prompt.text,
      readings.get(entry.id) ?? "",
      sample.selectionOf.get(entry.id) ?? "floor",
      (sample.floorForOf.get(entry.id) ?? []).join("|"),
      // The role the entry was actually given, one profile at a time. Without
      // it `role_verdict` asks the reviewer to judge something the sheet never
      // shows them; flattened into per-column sets, it asks them to judge
      // something the sheet shows them wrong.
      formatAssignedProfiles(role?.profiles ?? []),
      String(role?.profiles.length ?? 0),
      ...STRATUM_NAMES.map((name) => stratum[name]),
    ];
    fixedRows.push(fixed);
    lines.push(csvLine([...fixed, ...REVIEW_COLUMNS.map(() => "")]));
  }

  const outUrl = new URL(`../${options.out}`, import.meta.url);
  // Refuses to overwrite work. A drawn sheet is a thing a person then spends
  // hours filling in, and the default output path is the one they filled.
  const existing = await readFile(outUrl, "utf8").catch(() => null);
  if (existing !== null && !options.force && sheetHasVerdicts(existing)) {
    fail(
      `${options.out} already holds review verdicts. Move it aside before drawing a new`
      + " sample, or pass --force if you really mean to discard them.",
    );
  }
  await mkdir(new URL(".", outUrl), { recursive: true });
  // BOM, so the reviewer's spreadsheet reads the Chinese as UTF-8 rather than as
  // the system code page. LF endings, because `.gitattributes` pins the whole
  // tree to LF -- emitting CRLF here would leave the sheet reported as modified
  // every time it is redrawn, on a file whose point is that its diff is the
  // reviewer's verdicts.
  await writeFile(outUrl, `﻿${lines.join("\n")}\n`, "utf8");

  // Everything the scorer will refuse to run without. `sheetDigest` ties the
  // metadata to that sheet; `manifest` ties the rest of the metadata to both, so
  // the draw parameters and the recorded source digests cannot be edited while
  // the sheet still verifies.
  const bound = {
    schema: "catalog-qa-sample-v5",
    seed: options.seed,
    base: options.base,
    perLevel: options.perLevel,
    sheetDigest: sheetDigest(fixedRows),
    // Named for what they are. These are the source digests as they stood when
    // the sample was drawn, copied down and bound against edits -- not digests
    // this tool recomputes and checks, which it cannot do: the sample may have
    // been drawn from an older commit, so disagreement with the working tree is
    // expected rather than an error.
    recordedSourceDigests: digests,
  };
  const meta = {
    ...bound,
    manifestDigest: manifestDigest(bound),
    baseSampleSize: fixedRows.filter((row) => row[3] === "base").length,
    catalogEntryCount: entries.length,
    sampleSize: rows.length,
    strata: Object.fromEntries(STRATUM_NAMES.map((name) => [name, {
      sampled: Object.fromEntries(countLevels(rows, strata, name)),
      catalog: Object.fromEntries(countLevels(entries, strata, name)),
    }])),
    drawnAt: new Date().toISOString(),
  };
  await writeFile(
    new URL(`../${options.out.replace(/\.csv$/, "")}.meta.json`, import.meta.url),
    // Sealed as it is written, so the descriptive fields are bound from the
    // start rather than by a separate step somebody has to remember to run.
    `${JSON.stringify({ ...meta, integrityDigest: metadataIntegrityDigest(meta) }, null, 2)}\n`,
    "utf8",
  );

  console.log(`drew ${rows.length} of ${entries.length} entries into ${options.out}`);
  console.log(`catalog digest ${digests.catalog}`);
  // Sample counts beside catalog counts, always. The floor per level deliberately
  // over-draws the rare strata, so a sample count read on its own says nothing
  // about how much of the catalog the stratum covers -- and a rate measured in an
  // over-drawn stratum cannot be averaged into a headline without this weight.
  console.log("");
  console.log("stratum                 sampled / in catalog");
  for (const name of STRATUM_NAMES) {
    const sampled = countLevels(rows, strata, name);
    const population = countLevels(entries, strata, name);
    console.log(`  ${name}`);
    for (const [level, count] of [...population].sort((left, right) => right[1] - left[1])) {
      const share = ((count / entries.length) * 100).toFixed(1);
      console.log(
        `    ${level.padEnd(22)} ${String(sampled.get(level) ?? 0).padStart(4)} / ${String(count).padStart(6)}`
        + ` (${share.padStart(5)}% of catalog)`,
      );
    }
  }
}

function countLevels(
  entries: readonly CatalogEntry[],
  strata: ReadonlyMap<string, Strata>,
  name: keyof Strata,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const level = strata.get(entry.id)?.[name] ?? "?";
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return counts;
}

function isVerdict(value: string): value is Verdict {
  return (VERDICTS as readonly string[]).includes(value);
}

interface SampleMeta {
  readonly schema?: string;
  readonly seed?: string;
  readonly base?: number;
  readonly perLevel?: number;
  readonly sheetDigest?: string;
  readonly manifestDigest?: string;
  readonly integrityDigest?: string;
  readonly recordedSourceDigests?: Readonly<Record<string, string>>;
}

async function score(options: Options): Promise<void> {
  const source = await readFile(new URL(`../${options.input}`, import.meta.url), "utf8");
  const parsed = parseCsv(source.replace(/^﻿/, ""));
  const records: readonly Readonly<Record<string, string>>[] = parsed.records.map((record) => record.values);

  // Before anything is counted. The row digest below looks its cells up by
  // column name, so relabelling the header row leaves it agreeing while every
  // answer reports as the other judgement.
  const headerError = catalogQaHeaderError(parsed.headers);
  if (headerError !== null) {
    return fail(
      `${options.input} has an invalid catalog QA header.`
      + `\n${headerError}`
      + "\nRefusing to score, because moved or relabelled verdict columns change what"
      + " the review answers mean without changing any row value.",
    );
  }

  // Required, and verified. It used to be optional and swallowed on any error,
  // which meant a mistyped path, a mismatched pair or a sheet whose rows had been
  // re-sorted all still produced numbers that looked official.
  const metaPath = options.meta ?? `${options.input.replace(/\.csv$/, "")}.meta.json`;
  let meta: SampleMeta;
  try {
    meta = JSON.parse(
      await readFile(new URL(`../${metaPath}`, import.meta.url), "utf8"),
    ) as SampleMeta;
  } catch (error) {
    return fail(
      `cannot read the sample metadata at ${metaPath}: ${error instanceof Error ? error.message : String(error)}`
      + "\nScoring needs the metadata drawn with the sheet. Pass --meta if it lives elsewhere.",
    );
  }
  if (meta.schema !== "catalog-qa-sample-v5") {
    return fail(
      `${metaPath} is schema "${meta.schema ?? "(none)"}", which this scorer cannot read.`
      + " Redraw the sample with the current tool.",
    );
  }
  const actualDigest = sheetDigest(
    records.map((record) => FIXED_COLUMNS.map((column) => record[column] ?? "")),
  );
  if (actualDigest !== meta.sheetDigest) {
    return fail(
      `${options.input} does not match ${metaPath}.`
      + `\n  expected ${meta.sheetDigest ?? "(none)"}`
      + `\n  actual   ${actualDigest}`
      + "\nEither the sheet is paired with the wrong metadata, or something outside the"
      + " verdict columns changed -- re-sorting the rows in a spreadsheet is enough."
      + " Refusing to score, because every number below would be computed against"
      + " rows that are no longer the ones that were drawn.",
    );
  }
  // The metadata has to hold together too. Without this the seed, the sample
  // sizes and the recorded source digests were free text that the report
  // reprinted under a heading implying they had been checked.
  const expectedManifest = manifestDigest({
    schema: meta.schema,
    seed: meta.seed,
    base: meta.base,
    perLevel: meta.perLevel,
    sheetDigest: meta.sheetDigest,
    recordedSourceDigests: meta.recordedSourceDigests,
  });
  if (expectedManifest !== meta.manifestDigest) {
    return fail(
      `${metaPath} does not match its own manifest digest.`
      + `\n  expected ${meta.manifestDigest ?? "(none)"}`
      + `\n  actual   ${expectedManifest}`
      + "\nThe seed, the sample sizes or the recorded source digests have been edited"
      + " since the draw. Refusing to score.",
    );
  }
  // And the descriptive half of the file: catalog and sample counts, the stratum
  // counts, the draw time. The manifest above leaves those unbound, so without
  // this they were free text the report reprinted while saying the metadata
  // agreed.
  const expectedIntegrity = metadataIntegrityDigest(meta as unknown as Record<string, unknown>);
  if (expectedIntegrity !== meta.integrityDigest) {
    return fail(
      `${metaPath} does not match its complete metadata digest.`
      + `\n  expected ${meta.integrityDigest ?? "(none)"}`
      + `\n  actual   ${expectedIntegrity}`
      + "\nThe catalog counts, sampled counts, strata or draw time have been edited"
      + " since the draw. Refusing to score.",
    );
  }
  console.log(`sheet and metadata agree (${metaPath})`);
  // Deliberately not called verified. These are the digests copied down at draw
  // time, bound against later editing; nothing here recomputes them from the
  // sources, because the sample may have been drawn from an older commit.
  console.log(
    `recorded at draw time: seed ${meta.seed ?? "?"},`
    + ` catalog ${meta.recordedSourceDigests?.["catalog"] ?? "(unrecorded)"}`,
  );

  const unfilled: string[] = [];
  for (const record of records) {
    const reading = (record["reading_verdict"] ?? "").trim();
    const role = (record["role_verdict"] ?? "").trim();
    if (reading === "" || role === "") unfilled.push(record["entry_id"] ?? "?");
    for (const [column, value] of [["reading_verdict", reading], ["role_verdict", role]] as const) {
      if (value !== "" && !isVerdict(value)) {
        throw new Error(`${record["entry_id"]}: ${column} must be one of ${VERDICTS.join("/")}, got "${value}"`);
      }
    }
  }
  if (unfilled.length > 0) {
    console.log(`${unfilled.length} of ${records.length} rows still have a blank verdict.`);
  }

  // Reading and role are reported apart and never combined. They fail for
  // different reasons and are fixed in different places, and one number covering
  // both would hide whichever is healthier behind whichever is not.
  //
  // What may be reported is decided in `catalog-qa-report.ts` and returned as a
  // value; this only prints it. The rule is the interesting part, and a rule
  // expressed as a sequence of console.log calls can only be tested by matching
  // strings against those calls.
  for (const [label, column] of [
    ["reading", "reading_verdict"],
    ["grammar role", "role_verdict"],
  ] as const) {
    console.log(renderColumnReport(buildColumnReport(records, label, column, STRATUM_NAMES)));
  }
}

const options = parseOptions(process.argv.slice(2));
if (options.mode === "draw") await draw(options);
else await score(options);
