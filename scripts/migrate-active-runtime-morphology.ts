import { readFile, writeFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

const REVIEWED_FEATURE = "Voice=Cau" as const;
const UD_SOURCE_VERSION = "r2.18" as const;
const UD_SOURCE_COMMIT = "e0d85a020182e264d6384be2a59c0f4879a1cc35" as const;
const UD_FILENAMES = [
  "zh_gsd-ud-train.conllu",
  "zh_gsd-ud-dev.conllu",
  "zh_gsd-ud-test.conllu",
] as const;
const PROFILES_URL = new URL(
  "../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);

interface CausativeSourceEvidence {
  readonly tokenCount: number;
  readonly countsByLexemeUpos: ReadonlyMap<string, number>;
}

function lexemeUposKey(text: string, upos: string): string {
  return `${text}\u0000${upos}`;
}

function parseCausativeEvidence(source: string): CausativeSourceEvidence {
  const countsByLexemeUpos = new Map<string, number>();
  let tokenCount = 0;
  for (const line of source.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) continue;
    const columns = line.split("\t");
    if (columns.length !== 10 || !/^\d+$/u.test(columns[0] ?? "")) continue;
    const [tokenId, form, , upos, , feats] = columns;
    if (tokenId === undefined || form === undefined || upos === undefined || feats === undefined) {
      continue;
    }
    if (!feats.split("|").includes(REVIEWED_FEATURE)) continue;
    tokenCount += 1;
    const key = lexemeUposKey(form, upos);
    countsByLexemeUpos.set(key, (countsByLexemeUpos.get(key) ?? 0) + 1);
  }
  return { tokenCount, countsByLexemeUpos };
}

async function loadPinnedCausativeEvidence(): Promise<CausativeSourceEvidence> {
  const sources = await Promise.all(UD_FILENAMES.map(async (filename) => {
    const url = `https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/${UD_SOURCE_COMMIT}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch pinned ${UD_SOURCE_VERSION} source ${filename}: ${response.status}`);
    }
    return response.text();
  }));
  const merged = new Map<string, number>();
  let tokenCount = 0;
  for (const source of sources) {
    const evidence = parseCausativeEvidence(source);
    tokenCount += evidence.tokenCount;
    for (const [key, count] of evidence.countsByLexemeUpos) {
      merged.set(key, (merged.get(key) ?? 0) + count);
    }
  }
  return { tokenCount, countsByLexemeUpos: merged };
}

function assertExistingRuntimeMorphology(profile: RuntimeSyntaxProfile): void {
  const morphology = profile.dependencyEvidence.morphologicalFeatureCounts;
  if (morphology === undefined) return;
  const entries = Object.entries(morphology);
  if (entries.length !== 1 || entries[0]?.[0] !== REVIEWED_FEATURE || entries[0]?.[1] !== 1) {
    throw new Error(`active runtime profile contains unexpected morphology: ${profile.id}`);
  }
}

function withCausativePresence(
  profile: RuntimeSyntaxProfile,
  present: boolean,
): RuntimeSyntaxProfile {
  assertExistingRuntimeMorphology(profile);
  const { morphologicalFeatureCounts: _morphology, ...baseEvidence } = profile.dependencyEvidence;
  return {
    ...profile,
    dependencyEvidence: present
      ? { ...baseEvidence, morphologicalFeatureCounts: { [REVIEWED_FEATURE]: 1 } }
      : baseEvidence,
  };
}

const writeRequested = process.argv.includes("--write");
const [resolvedSource, provenanceSource, profilesSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(PROFILES_URL, "utf8"),
  loadPinnedCausativeEvidence(),
]);
const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}
const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const artifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const matchedSourceKeys = new Set<string>();
const activatedProfileIds: string[] = [];
const activatedEntryIds = new Set<string>();
const profiles = artifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) throw new Error(`active runtime profile references unknown catalog entry: ${profile.entryId}`);
  const sourceKey = lexemeUposKey(text, profile.upos);
  const present = sourceEvidence.countsByLexemeUpos.has(sourceKey);
  if (present) {
    matchedSourceKeys.add(sourceKey);
    activatedProfileIds.push(profile.id);
    activatedEntryIds.add(profile.entryId);
  }
  return withCausativePresence(profile, present);
});
const { determinismDigest: _oldDigest, ...artifactCore } = artifact;
const nextCore = { ...artifactCore, profiles };
const nextArtifact: ActiveCatalogSyntaxProfilesArtifact = {
  ...nextCore,
  determinismDigest: sha256Canonical(nextCore),
};
const output = `${JSON.stringify(nextArtifact)}\n`;
const isCurrent = output === profilesSource;
if (writeRequested && !isCurrent) await writeFile(PROFILES_URL, output, "utf8");
if (!writeRequested && !isCurrent) {
  throw new Error("active runtime morphology artifact is not current; rerun with --write");
}
const unmatchedSourceKeys = [...sourceEvidence.countsByLexemeUpos.keys()]
  .filter((key) => !matchedSourceKeys.has(key))
  .sort();
console.log(JSON.stringify({
  sourceVersion: UD_SOURCE_VERSION,
  sourceCommit: UD_SOURCE_COMMIT,
  reviewedFeature: REVIEWED_FEATURE,
  sourceTokenCount: sourceEvidence.tokenCount,
  sourceLexemeUposCount: sourceEvidence.countsByLexemeUpos.size,
  matchedLexemeUposCount: matchedSourceKeys.size,
  unmatchedLexemeUposCount: unmatchedSourceKeys.length,
  activatedEntryCount: activatedEntryIds.size,
  activatedProfileCount: activatedProfileIds.length,
  artifactChanged: !isCurrent,
  determinismDigest: nextArtifact.determinismDigest,
}));
