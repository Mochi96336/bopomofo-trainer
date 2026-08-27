import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import type { RuntimeOccurrenceCapabilityProjectionArtifact } from "../src/syntax/runtime-occurrence-capability-projection.js";
import { BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY } from "../src/syntax/runtime-occurrence-capabilities.js";
import {
  BA_OCCURRENCE_EVIDENCE_CONTRACT,
  loadPinnedBaOccurrenceEvidence,
} from "./ba-occurrence-source.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  lexemeUposKey,
} from "./ud-occurrence-source.js";

const IDENTITY_POLICY = "unique-active-entry-per-form-upos-v1" as const;
const PROFILES_URL = new URL(
  "../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);
const OUTPUT_URL = new URL(
  "../data/grammar/formal-syntax-runtime-ba-occurrence-capabilities.json",
  import.meta.url,
);

function optionValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a path`);
  }
  return value;
}

function sortedKeys(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort();
}

const writeRequested = process.argv.includes("--write");
const candidateOutputPath = optionValue("--output");
const [resolvedSource, provenanceSource, profilesSource, currentProjectionSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(PROFILES_URL, "utf8"),
  readFile(OUTPUT_URL, "utf8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }),
  loadPinnedBaOccurrenceEvidence(),
]);

const provenanceRecords = parseCsv(provenanceSource).records;
const provenance = createProvenanceRegistry(provenanceRecords);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}
const pinnedSourceRecord = provenanceRecords.find((record) => record.values.id === UD_GSD_PROVENANCE_ID);
const expectedPin = `Pinned source commit: ${UD_GSD_SOURCE_COMMIT}`;
if (!(pinnedSourceRecord?.values.notes ?? "").includes(expectedPin)) {
  throw new Error(`provenance ${UD_GSD_PROVENANCE_ID} must record ${expectedPin}`);
}

const markerCounts = Object.fromEntries([...sourceEvidence.markerCounts].sort(([left], [right]) => left.localeCompare(right)));
if (sourceEvidence.oblPatientPredicateTokenCount !== 196
  || sourceEvidence.oblPatientPredicateCounts.size !== 165
  || sourceEvidence.baMarkedPatientPredicateTokenCount !== 193
  || sourceEvidence.baMarkedPatientPredicateCounts.size !== 162
  || JSON.stringify(markerCounts) !== JSON.stringify({ "把": 61, "將": 132 })) {
  throw new Error("pinned BA same-occurrence source evidence drifted from the reviewed boundary");
}

const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const profilesArtifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const identityCandidates = profilesArtifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) {
    throw new Error(`active runtime profile references unknown catalog entry: ${profile.entryId}`);
  }
  return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
});
const sourceKeys = new Set(sourceEvidence.baMarkedPatientPredicateCounts.keys());
const identity = classifyRuntimeSourceIdentityMatches(identityCandidates, sourceKeys);
const unmatchedSourceKeys = sortedKeys(new Set([...sourceKeys].filter((key) => !identity.matchedSourceKeys.has(key))));
const ambiguousSourceKeys = sortedKeys(identity.ambiguousSourceKeys);

if (identity.matchedSourceKeys.size !== 145
  || identity.ambiguousSourceKeys.size !== 6
  || identity.activatableSourceKeys.size !== 139
  || unmatchedSourceKeys.length !== 17
  || JSON.stringify(ambiguousSourceKeys) !== JSON.stringify([
    "作\u0000VERB",
    "化\u0000PART",
    "圈\u0000VERB",
    "稱\u0000VERB",
    "給\u0000VERB",
    "轉\u0000VERB",
  ])) {
  throw new Error(
    `BA runtime identity join drifted from reviewed boundary: ${JSON.stringify({
      matchedLexemeUposCount: identity.matchedSourceKeys.size,
      ambiguousMatchedLexemeUposCount: identity.ambiguousSourceKeys.size,
      activatableLexemeUposCount: identity.activatableSourceKeys.size,
      unmatchedSourceKeyCount: unmatchedSourceKeys.length,
      ambiguousSourceKeys,
    })}`,
  );
}

const activatedProfileIds = new Set<string>();
const activatedEntryIds = new Set<string>();
for (const [index, profile] of profilesArtifact.profiles.entries()) {
  const sourceKey = identityCandidates[index]?.sourceKey;
  if (sourceKey === undefined) throw new Error(`missing BA occurrence identity candidate for ${profile.id}`);
  if (!identity.activatableSourceKeys.has(sourceKey)) continue;
  activatedProfileIds.add(profile.id);
  activatedEntryIds.add(profile.entryId);
}

const profileIds = [...activatedProfileIds].sort();
const projectionCore = {
  schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
  sourceProfileArtifactDigest: profilesArtifact.determinismDigest,
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: BA_OCCURRENCE_EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  profileCount: profileIds.length,
  entryCount: activatedEntryIds.size,
  profileIds,
};
const nextArtifact: RuntimeOccurrenceCapabilityProjectionArtifact = {
  ...projectionCore,
  determinismDigest: sha256Canonical(projectionCore),
};
const output = `${JSON.stringify(nextArtifact, null, 2)}\n`;
const isCurrent = output === currentProjectionSource;
const summary = {
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: BA_OCCURRENCE_EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  sourceTokenCount: sourceEvidence.baMarkedPatientPredicateTokenCount,
  sourceLexemeUposCount: sourceKeys.size,
  matchedLexemeUposCount: identity.matchedSourceKeys.size,
  ambiguousMatchedLexemeUposCount: identity.ambiguousSourceKeys.size,
  activatableLexemeUposCount: identity.activatableSourceKeys.size,
  unmatchedSourceKeyCount: unmatchedSourceKeys.length,
  activatedProfileCount: activatedProfileIds.size,
  activatedEntryCount: activatedEntryIds.size,
  artifactChanged: !isCurrent,
  determinismDigest: nextArtifact.determinismDigest,
};
console.log(JSON.stringify(summary));

if (candidateOutputPath !== undefined) {
  await writeFile(resolve(candidateOutputPath), output, "utf8");
}
if (writeRequested && !isCurrent) await writeFile(OUTPUT_URL, output, "utf8");
if (!writeRequested && !isCurrent) {
  throw new Error("BA runtime occurrence capability projection artifact is not current; rerun with --write");
}
