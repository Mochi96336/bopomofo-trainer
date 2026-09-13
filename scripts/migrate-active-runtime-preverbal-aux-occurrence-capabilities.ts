import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type { RuntimeOccurrenceCapabilityProjectionArtifact } from "../src/syntax/runtime-occurrence-capability-projection.js";
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "../src/syntax/runtime-occurrence-capabilities.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import {
  PREVERBAL_AUX_EVIDENCE_CONTRACT,
  auditPinnedModalitySourceEvidence,
} from "./modality-source-evidence.js";
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
  "../data/grammar/formal-syntax-runtime-preverbal-aux-occurrence-capabilities.json",
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

function formForSourceKey(sourceKey: string): string {
  return sourceKey.split("\u0000", 1)[0] ?? sourceKey;
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

if (sourceEvidence.preverbalAuxEvidenceContract !== PREVERBAL_AUX_EVIDENCE_CONTRACT
  || sourceEvidence.preverbalAuxTokenCount !== 875
  || Object.keys(sourceEvidence.preverbalAuxFormCounts).length !== 37
  || sourceEvidence.postverbalAuxTokenCount !== 953
  || sourceEvidence.moodFeatureCounts !== undefined && Object.keys(sourceEvidence.moodFeatureCounts).length !== 0
  || sourceEvidence.verbTypeFeatureCounts !== undefined && Object.keys(sourceEvidence.verbTypeFeatureCounts).length !== 0) {
  throw new Error("pinned preverbal AUX source evidence drifted from the reviewed boundary");
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
const sourceKeys = new Set(
  Object.keys(sourceEvidence.preverbalAuxFormCounts).map((form) => lexemeUposKey(form, "AUX")),
);
const identity = classifyRuntimeSourceIdentityMatches(identityCandidates, sourceKeys);
const unmatchedSourceKeys = sortedKeys(new Set([...sourceKeys].filter((key) => !identity.matchedSourceKeys.has(key))));
const ambiguousSourceKeys = sortedKeys(identity.ambiguousSourceKeys);
const activatableSourceKeys = sortedKeys(identity.activatableSourceKeys);

const EXPECTED_AMBIGUOUS_SOURCE_KEYS = [
  "了\u0000AUX",
  "可\u0000AUX",
  "得\u0000AUX",
  "應\u0000AUX",
  "會\u0000AUX",
  "著\u0000AUX",
  "要\u0000AUX",
] as const;
const EXPECTED_UNMATCHED_SOURCE_KEYS = [
  "不想\u0000AUX",
  "不應\u0000AUX",
  "不該\u0000AUX",
  "不需\u0000AUX",
  "不願\u0000AUX",
  "未能\u0000AUX",
  "沒能\u0000AUX",
  "都是\u0000AUX",
] as const;

const tokenMass = (keys: readonly string[]): number => keys.reduce(
  (sum, key) => sum + (sourceEvidence.preverbalAuxFormCounts[formForSourceKey(key)] ?? 0),
  0,
);

if (identity.matchedSourceKeys.size !== 29
  || identity.ambiguousSourceKeys.size !== 7
  || identity.activatableSourceKeys.size !== 22
  || unmatchedSourceKeys.length !== 8
  || tokenMass(activatableSourceKeys) !== 460
  || tokenMass(ambiguousSourceKeys) !== 387
  || tokenMass(unmatchedSourceKeys) !== 28
  || JSON.stringify(ambiguousSourceKeys) !== JSON.stringify(EXPECTED_AMBIGUOUS_SOURCE_KEYS)
  || JSON.stringify(unmatchedSourceKeys) !== JSON.stringify(EXPECTED_UNMATCHED_SOURCE_KEYS)) {
  throw new Error(
    `preverbal AUX runtime identity join drifted from reviewed boundary: ${JSON.stringify({
      matchedSourceKeyCount: identity.matchedSourceKeys.size,
      ambiguousSourceKeyCount: identity.ambiguousSourceKeys.size,
      activatableSourceKeyCount: identity.activatableSourceKeys.size,
      unmatchedSourceKeyCount: unmatchedSourceKeys.length,
      activatableSourceTokenCount: tokenMass(activatableSourceKeys),
      ambiguousSourceTokenCount: tokenMass(ambiguousSourceKeys),
      unmatchedSourceTokenCount: tokenMass(unmatchedSourceKeys),
      ambiguousSourceKeys,
      unmatchedSourceKeys,
    })}`,
  );
}

const activatedProfileIds = new Set<string>();
const activatedEntryIds = new Set<string>();
for (const [index, profile] of profilesArtifact.profiles.entries()) {
  const sourceKey = identityCandidates[index]?.sourceKey;
  if (sourceKey === undefined) throw new Error(`missing preverbal AUX identity candidate for ${profile.id}`);
  if (!identity.activatableSourceKeys.has(sourceKey)) continue;
  if (profile.upos !== "AUX" || !profile.functions.includes("auxiliary")) {
    throw new Error(`preverbal AUX sidecar targets non-auxiliary runtime profile: ${profile.id}`);
  }
  activatedProfileIds.add(profile.id);
  activatedEntryIds.add(profile.entryId);
}
if (activatedProfileIds.size !== 22 || activatedEntryIds.size !== 22) {
  throw new Error("preverbal AUX activated runtime frontier drifted from reviewed boundary");
}

const profileIds = [...activatedProfileIds].sort();
const projectionCore = {
  schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
  sourceProfileArtifactDigest: profilesArtifact.determinismDigest,
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: PREVERBAL_AUX_EVIDENCE_CONTRACT,
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
  reviewedCapability: PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: PREVERBAL_AUX_EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  sourceTokenCount: sourceEvidence.preverbalAuxTokenCount,
  sourceFormCount: sourceKeys.size,
  matchedSourceKeyCount: identity.matchedSourceKeys.size,
  ambiguousSourceKeyCount: identity.ambiguousSourceKeys.size,
  activatableSourceKeyCount: identity.activatableSourceKeys.size,
  unmatchedSourceKeyCount: unmatchedSourceKeys.length,
  activatableSourceTokenCount: tokenMass(activatableSourceKeys),
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
  throw new Error(
    "preverbal AUX runtime occurrence capability projection artifact is not current; rerun with --write",
  );
}
