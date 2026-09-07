import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import { auditPinnedModalitySourceEvidence } from "./modality-source-evidence.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  lexemeUposKey,
} from "./ud-occurrence-source.js";

const [resolvedSource, provenanceSource, profilesSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  auditPinnedModalitySourceEvidence(),
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

const sourceForms = Object.keys(sourceEvidence.preverbalAuxFormCounts);
const sourceKeys = new Set(sourceForms.map((form) => lexemeUposKey(form, "AUX")));
const identity = classifyRuntimeSourceIdentityMatches(identityCandidates, sourceKeys);
const unmatchedSourceKeys = [...sourceKeys]
  .filter((key) => !identity.matchedSourceKeys.has(key))
  .sort();
const ambiguousSourceKeys = [...identity.ambiguousSourceKeys].sort();
const activatableSourceKeys = [...identity.activatableSourceKeys].sort();

const activatedProfileIds = new Set<string>();
const activatedEntryIds = new Set<string>();
for (const [index, profile] of profilesArtifact.profiles.entries()) {
  const sourceKey = identityCandidates[index]?.sourceKey;
  if (sourceKey === undefined || !identity.activatableSourceKeys.has(sourceKey)) continue;
  activatedProfileIds.add(profile.id);
  activatedEntryIds.add(profile.entryId);
}

function formForSourceKey(sourceKey: string): string {
  return sourceKey.split("\u0000", 1)[0] ?? sourceKey;
}

function occurrenceCountForSourceKey(sourceKey: string): number {
  return sourceEvidence.preverbalAuxFormCounts[formForSourceKey(sourceKey)] ?? 0;
}

function sourceKeyRows(keys: readonly string[]) {
  return keys.map((sourceKey) => ({
    sourceKey,
    sourceOccurrenceCount: occurrenceCountForSourceKey(sourceKey),
  }));
}

function tokenMass(keys: readonly string[]): number {
  return keys.reduce((sum, key) => sum + occurrenceCountForSourceKey(key), 0);
}

const inspectForm = (form: string) => {
  const key = lexemeUposKey(form, "AUX");
  return {
    form,
    sourceOccurrenceCount: sourceEvidence.preverbalAuxFormCounts[form] ?? 0,
    matched: identity.matchedSourceKeys.has(key),
    ambiguous: identity.ambiguousSourceKeys.has(key),
    activatable: identity.activatableSourceKeys.has(key),
  };
};

console.log(JSON.stringify({
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: sourceEvidence.preverbalAuxEvidenceContract,
  sourceTokenCount: sourceEvidence.preverbalAuxTokenCount,
  sourceFormCount: sourceForms.length,
  matchedSourceKeyCount: identity.matchedSourceKeys.size,
  ambiguousSourceKeyCount: identity.ambiguousSourceKeys.size,
  activatableSourceKeyCount: identity.activatableSourceKeys.size,
  unmatchedSourceKeyCount: unmatchedSourceKeys.length,
  activatedProfileCount: activatedProfileIds.size,
  activatedEntryCount: activatedEntryIds.size,
  activatableSourceTokenCount: tokenMass(activatableSourceKeys),
  ambiguousSourceTokenCount: tokenMass(ambiguousSourceKeys),
  unmatchedSourceTokenCount: tokenMass(unmatchedSourceKeys),
  activatableSourceKeys: sourceKeyRows(activatableSourceKeys),
  ambiguousSourceKeys: sourceKeyRows(ambiguousSourceKeys),
  unmatchedSourceKeys: sourceKeyRows(unmatchedSourceKeys),
  aspectExceptions: [inspectForm("了"), inspectForm("著")],
}, null, 2));
