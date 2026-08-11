import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type {
  ActiveCatalogSyntaxProfilesArtifact,
  RuntimeOccurrenceCapabilityProjectionLineage,
} from "../src/syntax/runtime-profiles.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";
import {
  CAUSATIVE_OCCURRENCE_CAPABILITY,
  CAUSATIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  CAUSATIVE_REVIEWED_FEATURE,
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  lexemeUposKey,
  loadPinnedCausativeOccurrenceEvidence,
} from "./causative-occurrence-source.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";

const IDENTITY_POLICY = "unique-active-entry-per-form-upos-v1" as const;
const PROFILES_URL = new URL(
  "../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);

const OCCURRENCE_LINEAGE: RuntimeOccurrenceCapabilityProjectionLineage = {
  schemaVersion: "runtime-occurrence-capability-projection-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: CAUSATIVE_OCCURRENCE_CAPABILITY,
  evidenceContract: CAUSATIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
};

function optionValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a path`);
  }
  return value;
}

function hasAggregateCausativeCcomp(profile: RuntimeSyntaxProfile): boolean {
  return (profile.dependencyEvidence.morphologicalFeatureCounts?.[CAUSATIVE_REVIEWED_FEATURE] ?? 0) > 0
    && profile.valencyFrames.includes("clausal-complement");
}

function withOccurrenceCapability(
  profile: RuntimeSyntaxProfile,
  present: boolean,
): RuntimeSyntaxProfile {
  const existing = profile.occurrenceCapabilities;
  if (existing !== undefined
    && (existing.length !== 1 || existing[0] !== CAUSATIVE_OCCURRENCE_CAPABILITY)) {
    throw new Error(`active runtime profile contains unexpected occurrence capability: ${profile.id}`);
  }
  const { occurrenceCapabilities: _oldCapabilities, ...baseProfile } = profile;
  return present
    ? { ...baseProfile, occurrenceCapabilities: [CAUSATIVE_OCCURRENCE_CAPABILITY] }
    : baseProfile;
}

function sortedTexts(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

const writeRequested = process.argv.includes("--write");
const candidateOutputPath = optionValue("--output");
const [resolvedSource, provenanceSource, profilesSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(PROFILES_URL, "utf8"),
  loadPinnedCausativeOccurrenceEvidence(),
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
const artifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const identityCandidates = artifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) {
    throw new Error(`active runtime profile references unknown catalog entry: ${profile.entryId}`);
  }
  return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
});
const identity = classifyRuntimeSourceIdentityMatches(
  identityCandidates,
  new Set(sourceEvidence.sameTokenCcompCounts.keys()),
);

const aggregateProfileIds = new Set<string>();
const aggregateEntryIds = new Set<string>();
const activatedProfileIds = new Set<string>();
const activatedEntryIds = new Set<string>();
const aggregateOnlyTexts = new Set<string>();

const profiles = artifact.profiles.map((profile, index) => {
  const sourceKey = identityCandidates[index]?.sourceKey;
  if (sourceKey === undefined) throw new Error(`missing occurrence identity candidate for ${profile.id}`);
  const aggregateEligible = hasAggregateCausativeCcomp(profile);
  if (aggregateEligible) {
    aggregateProfileIds.add(profile.id);
    aggregateEntryIds.add(profile.entryId);
  }
  const present = aggregateEligible && identity.activatableSourceKeys.has(sourceKey);
  if (present) {
    activatedProfileIds.add(profile.id);
    activatedEntryIds.add(profile.entryId);
  } else if (aggregateEligible) {
    const text = textByEntryId.get(profile.entryId);
    if (text !== undefined) aggregateOnlyTexts.add(text);
  }
  return withOccurrenceCapability(profile, present);
});

const aggregateOnly = sortedTexts(aggregateOnlyTexts);
if (aggregateProfileIds.size !== 122
  || aggregateEntryIds.size !== 122
  || activatedProfileIds.size !== 121
  || activatedEntryIds.size !== 121
  || JSON.stringify(aggregateOnly) !== JSON.stringify(["阻止"])) {
  throw new Error(
    `same-occurrence causative-ccomp projection drifted from reviewed boundary: ${JSON.stringify({
      aggregateProfileCount: aggregateProfileIds.size,
      aggregateEntryCount: aggregateEntryIds.size,
      activatedProfileCount: activatedProfileIds.size,
      activatedEntryCount: activatedEntryIds.size,
      aggregateOnly,
    })}`,
  );
}

const {
  determinismDigest: _oldDigest,
  runtimeOccurrenceCapabilityProjection: _oldOccurrenceProjection,
  ...artifactCore
} = artifact;
const nextCore = {
  ...artifactCore,
  runtimeOccurrenceCapabilityProjection: OCCURRENCE_LINEAGE,
  profiles,
};
const nextArtifact: ActiveCatalogSyntaxProfilesArtifact = {
  ...nextCore,
  determinismDigest: sha256Canonical(nextCore),
};
const output = `${JSON.stringify(nextArtifact)}\n`;
const isCurrent = output === profilesSource;
const summary = {
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: CAUSATIVE_OCCURRENCE_CAPABILITY,
  evidenceContract: CAUSATIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  sameTokenCcompTokenCount: sourceEvidence.sameTokenCcompTokenCount,
  sameTokenCcompLexemeUposCount: sourceEvidence.sameTokenCcompCounts.size,
  matchedLexemeUposCount: identity.matchedSourceKeys.size,
  ambiguousMatchedLexemeUposCount: identity.ambiguousSourceKeys.size,
  activatableLexemeUposCount: identity.activatableSourceKeys.size,
  aggregateProfileCount: aggregateProfileIds.size,
  aggregateEntryCount: aggregateEntryIds.size,
  activatedProfileCount: activatedProfileIds.size,
  activatedEntryCount: activatedEntryIds.size,
  aggregateOnly,
  artifactChanged: !isCurrent,
  determinismDigest: nextArtifact.determinismDigest,
};
console.log(JSON.stringify(summary));

if (candidateOutputPath !== undefined) {
  await writeFile(resolve(candidateOutputPath), output, "utf8");
}
if (writeRequested && !isCurrent) await writeFile(PROFILES_URL, output, "utf8");
if (!writeRequested && !isCurrent) {
  throw new Error("active runtime occurrence-capability artifact is not current; rerun with --write");
}
