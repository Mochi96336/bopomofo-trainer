import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import type { RuntimeOccurrenceCapabilityProjectionArtifact } from "../src/syntax/runtime-occurrence-capability-projection.js";
import { VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY } from "../src/syntax/runtime-occurrence-capabilities.js";
import { auditPinnedLocativeSourceEvidence } from "./locative-source-evidence.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  lexemeUposKey,
} from "./ud-occurrence-source.js";

const IDENTITY_POLICY = "unique-active-entry-per-form-upos-v1" as const;
const EVIDENCE_CONTRACT = "same-predicate-verbal-locative-root-subject-object-v1" as const;
const PROFILES_URL = new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url);
const OUTPUT_URL = new URL(
  "../data/grammar/formal-syntax-runtime-locative-occurrence-capabilities.json",
  import.meta.url,
);

function optionValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a path`);
  return value;
}

const writeRequested = process.argv.includes("--write");
const candidateOutputPath = optionValue("--output");
const [resolvedSource, provenanceSource, profilesSource, currentProjectionSource, evidence] =
  await Promise.all([
    loadResolvedCatalogSource(),
    readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
    readFile(PROFILES_URL, "utf8"),
    readFile(OUTPUT_URL, "utf8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }),
    auditPinnedLocativeSourceEvidence(),
  ]);

const sourceKey = lexemeUposKey("在", "VERB");
if (evidence.zaiVerbRootWithSubjectAndObjectTokenCount !== 12
  || evidence.verbalLocativePredicateCounts.size !== 1
  || evidence.verbalLocativePredicateCounts.get(sourceKey) !== 12) {
  throw new Error("pinned verbal locative occurrence frontier drifted from reviewed boundary");
}

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
const candidates = profilesArtifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) throw new Error(`unknown active catalog entry: ${profile.entryId}`);
  return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
});
const identity = classifyRuntimeSourceIdentityMatches(candidates, new Set([sourceKey]));
if (identity.matchedSourceKeys.size !== 1
  || identity.ambiguousSourceKeys.size !== 0
  || identity.activatableSourceKeys.size !== 1) {
  throw new Error("verbal locative runtime identity join drifted from reviewed boundary");
}

const activatedProfiles = profilesArtifact.profiles.filter((profile, index) => {
  const candidate = candidates[index];
  return candidate !== undefined && identity.activatableSourceKeys.has(candidate.sourceKey);
});
if (activatedProfiles.length !== 1
  || activatedProfiles[0]?.entryId !== "word:在:ㄗㄞ4"
  || activatedProfiles[0]?.upos !== "VERB"
  || !activatedProfiles[0]?.functions.includes("predicate")) {
  throw new Error("verbal locative runtime activation boundary drifted");
}

const profileIds = activatedProfiles.map((profile) => profile.id).sort();
const projectionCore = {
  schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
  sourceProfileArtifactDigest: profilesArtifact.determinismDigest,
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedCapability: VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  profileCount: profileIds.length,
  entryCount: new Set(activatedProfiles.map((profile) => profile.entryId)).size,
  profileIds,
};
const nextArtifact: RuntimeOccurrenceCapabilityProjectionArtifact = {
  ...projectionCore,
  determinismDigest: sha256Canonical(projectionCore),
};
const output = `${JSON.stringify(nextArtifact, null, 2)}\n`;
const isCurrent = output === currentProjectionSource;

console.log(JSON.stringify({
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  sourceTokenCount: 12,
  sourceKey,
  reviewedCapability: VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
  evidenceContract: EVIDENCE_CONTRACT,
  identityPolicy: IDENTITY_POLICY,
  matchedSourceKeyCount: identity.matchedSourceKeys.size,
  ambiguousSourceKeyCount: identity.ambiguousSourceKeys.size,
  activatableSourceKeyCount: identity.activatableSourceKeys.size,
  activatedProfileCount: profileIds.length,
  activatedEntryCount: projectionCore.entryCount,
  activatedProfileIds: profileIds,
  artifactChanged: !isCurrent,
  determinismDigest: nextArtifact.determinismDigest,
}));

if (candidateOutputPath !== undefined) await writeFile(resolve(candidateOutputPath), output, "utf8");
if (writeRequested && !isCurrent) await writeFile(OUTPUT_URL, output, "utf8");
if (!writeRequested && !isCurrent) {
  throw new Error("locative runtime occurrence capability projection artifact is not current; rerun with --write");
}
