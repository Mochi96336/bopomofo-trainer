import { readFile, writeFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import type { CatalogSyntaxLegalityArtifact } from "../src/syntax/catalog-legality.js";
import { projectRuntimeMorphologicalFeatureCounts } from "../src/syntax/runtime-morphology.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import type { RuntimeSyntaxProfile, SyntaxProfile, Upos } from "../src/syntax/types.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

interface SourceRuleIndex {
  readonly selectionDigest: string;
  readonly evidenceDigest: string;
  readonly profileProjectionDigest: string;
  readonly profileArtifactDigest: string;
  readonly entries: readonly {
    readonly entryId: string;
    readonly text: string;
  }[];
}

interface SourceProfilesArtifact {
  readonly selectionDigest: string;
  readonly evidenceDigest: string;
  readonly projectionDigest: string;
  readonly determinismDigest: string;
  readonly profiles: readonly SyntaxProfile[];
}

function optionValue(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a path`);
  }
  return value;
}

function key(entryId: string, upos: Upos): string {
  return `${entryId}\u0000${upos}`;
}

const sourceRuleIndexPath = optionValue("--rule-index");
const sourceProfilesPath = optionValue("--profiles");
const activeProfilesPath = "data/grammar/formal-syntax-active-catalog-profiles.json";
const legalityPath = "data/grammar/formal-syntax-active-catalog-legality.json";

const [
  resolvedSource,
  provenanceSource,
  sourceRuleIndexText,
  sourceProfilesText,
  activeProfilesText,
  legalityText,
] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(sourceRuleIndexPath, "utf8"),
  readFile(sourceProfilesPath, "utf8"),
  readFile(activeProfilesPath, "utf8"),
  readFile(legalityPath, "utf8"),
]);

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((item) => item.message).join("\n"));
}
const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((item) => item.message).join("\n"));
}

const sourceRuleIndex = JSON.parse(sourceRuleIndexText) as SourceRuleIndex;
const sourceProfiles = JSON.parse(sourceProfilesText) as SourceProfilesArtifact;
const activeProfiles = JSON.parse(activeProfilesText) as ActiveCatalogSyntaxProfilesArtifact;
const legality = JSON.parse(legalityText) as CatalogSyntaxLegalityArtifact;

if (sourceProfiles.selectionDigest !== sourceRuleIndex.selectionDigest
  || sourceProfiles.evidenceDigest !== sourceRuleIndex.evidenceDigest
  || sourceProfiles.projectionDigest !== sourceRuleIndex.profileProjectionDigest
  || sourceProfiles.determinismDigest !== sourceRuleIndex.profileArtifactDigest) {
  throw new Error("regenerated source profiles do not match regenerated source lineage");
}
if (sourceProfiles.selectionDigest !== activeProfiles.sourceSelectionDigest
  || sourceProfiles.evidenceDigest !== activeProfiles.sourceEvidenceDigest) {
  throw new Error("regenerated source inputs do not reproduce active source selection/evidence lineage");
}
if (activeProfiles.sourceRuleIndexDigest !== legality.sourceRuleIndexDigest) {
  throw new Error("active profile and legality artifacts disagree on the frozen source-rule-index frontier");
}
if (activeProfiles.profileCount !== activeProfiles.profiles.length || activeProfiles.profileCount !== 16_266) {
  throw new Error(`unexpected active source-runtime frontier: ${activeProfiles.profileCount}`);
}
if (legality.catalogEntryCount !== 13_897 || legality.legalEntryCount !== 13_897 || legality.exclusionCount !== 0) {
  throw new Error("unexpected active source legality frontier");
}

const textByCatalogEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const sourceEntryByText = new Map<string, string>();
for (const entry of sourceRuleIndex.entries) {
  if (sourceEntryByText.has(entry.text)) throw new Error(`duplicate source rule-index text: ${entry.text}`);
  sourceEntryByText.set(entry.text, entry.entryId);
}
const sourceProfileByEntryUpos = new Map<string, SyntaxProfile>();
for (const profile of sourceProfiles.profiles) {
  const profileKey = key(profile.entryId, profile.upos);
  if (sourceProfileByEntryUpos.has(profileKey)) {
    throw new Error(`duplicate regenerated source profile identity: ${profileKey}`);
  }
  sourceProfileByEntryUpos.set(profileKey, profile);
}

const nextProfiles: RuntimeSyntaxProfile[] = [];
let reconstructedOldProfileCount = 0;
let changedProfileIdCount = 0;
let changedValencyProfileCount = 0;
let removedAmbitransitiveCount = 0;
let removedIntransitiveCount = 0;
let addedValencyFrameCount = 0;
const changedEntryIds = new Set<string>();

for (const oldProfile of activeProfiles.profiles) {
  const text = textByCatalogEntryId.get(oldProfile.entryId);
  if (text === undefined) throw new Error(`active profile references unknown catalog entry: ${oldProfile.entryId}`);
  const sourceEntryId = sourceEntryByText.get(text);
  if (sourceEntryId === undefined) throw new Error(`active profile text missing from regenerated top-160000 source: ${text}`);
  const sourceProfile = sourceProfileByEntryUpos.get(key(sourceEntryId, oldProfile.upos));
  if (sourceProfile === undefined) {
    throw new Error(`active profile UPOS missing from regenerated source: ${text}/${oldProfile.upos}`);
  }

  const reconstructedOldSourceProfileId = `syntax-profile:${sha256Canonical({
    entryId: sourceProfile.entryId,
    upos: sourceProfile.upos,
    functions: sourceProfile.functions,
    valencyFrames: oldProfile.valencyFrames,
    dependencyEvidence: sourceProfile.dependencyEvidence,
  })}`;
  const reconstructedOldRuntimeProfileId = `runtime-syntax-profile:${sha256Canonical({
    sourceProfileId: reconstructedOldSourceProfileId,
    catalogEntryId: oldProfile.entryId,
  })}`;
  if (reconstructedOldRuntimeProfileId !== oldProfile.id) {
    throw new Error(
      `cannot reconstruct old runtime profile identity for ${text}/${oldProfile.upos}: ${reconstructedOldRuntimeProfileId} != ${oldProfile.id}`,
    );
  }
  reconstructedOldProfileCount += 1;

  const oldFrames = new Set(oldProfile.valencyFrames);
  const nextFrames = new Set(sourceProfile.valencyFrames);
  const valencyChanged = oldProfile.valencyFrames.length !== sourceProfile.valencyFrames.length
    || oldProfile.valencyFrames.some((frame) => !nextFrames.has(frame));
  if (valencyChanged) {
    changedValencyProfileCount += 1;
    changedEntryIds.add(oldProfile.entryId);
    if (oldFrames.has("ambitransitive") && !nextFrames.has("ambitransitive")) removedAmbitransitiveCount += 1;
    if (oldFrames.has("intransitive") && !nextFrames.has("intransitive")) removedIntransitiveCount += 1;
    for (const frame of nextFrames) if (!oldFrames.has(frame)) addedValencyFrameCount += 1;
  }

  const morphologicalFeatureCounts = projectRuntimeMorphologicalFeatureCounts(
    sourceProfile.dependencyEvidence.morphologicalFeatureCounts,
  );
  const nextProfile: RuntimeSyntaxProfile = {
    id: `runtime-syntax-profile:${sha256Canonical({
      sourceProfileId: sourceProfile.id,
      catalogEntryId: oldProfile.entryId,
    })}`,
    entryId: oldProfile.entryId,
    upos: sourceProfile.upos,
    functions: sourceProfile.functions,
    valencyFrames: sourceProfile.valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: sourceProfile.dependencyEvidence.dependencyRelationCounts,
      surfacePositionCounts: sourceProfile.dependencyEvidence.surfacePositionCounts,
      ...(morphologicalFeatureCounts === undefined ? {} : { morphologicalFeatureCounts }),
    },
    provenanceIds: sourceProfile.provenanceIds,
  };
  if (nextProfile.id !== oldProfile.id) changedProfileIdCount += 1;
  nextProfiles.push(nextProfile);
}

if (reconstructedOldProfileCount !== 16_266
  || nextProfiles.length !== 16_266
  || changedValencyProfileCount !== 739
  || changedEntryIds.size !== 737
  || removedAmbitransitiveCount !== 629
  || removedIntransitiveCount !== 739
  || addedValencyFrameCount !== 0) {
  throw new Error(`reviewed #232 impact boundary drifted: ${JSON.stringify({
    reconstructedOldProfileCount,
    nextProfileCount: nextProfiles.length,
    changedProfileIdCount,
    changedValencyProfileCount,
    changedEntryCount: changedEntryIds.size,
    removedAmbitransitiveCount,
    removedIntransitiveCount,
    addedValencyFrameCount,
  })}`);
}

nextProfiles.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
const profilesCore = {
  schemaVersion: activeProfiles.schemaVersion,
  grammarVersion: activeProfiles.grammarVersion,
  catalogEntryCount: activeProfiles.catalogEntryCount,
  catalogDigest: activeProfiles.catalogDigest,
  sourceSelectionDigest: sourceProfiles.selectionDigest,
  sourceEvidenceDigest: sourceProfiles.evidenceDigest,
  sourceProfileProjectionDigest: sourceProfiles.projectionDigest,
  sourceProfileArtifactDigest: sourceProfiles.determinismDigest,
  // The complete 13,897-entry reviewed source-runtime frontier stays frozen.
  // Current grammar packaging is a downstream concern and must not be folded
  // into this #271 source-profile migration.
  sourceRuleIndexDigest: activeProfiles.sourceRuleIndexDigest,
  profileCount: nextProfiles.length,
  profiles: nextProfiles,
};
const nextActiveProfiles: ActiveCatalogSyntaxProfilesArtifact = {
  ...profilesCore,
  determinismDigest: sha256Canonical(profilesCore),
};

const legalityCore = {
  schemaVersion: legality.schemaVersion,
  grammarVersion: legality.grammarVersion,
  catalogEntryCount: legality.catalogEntryCount,
  catalogDigest: legality.catalogDigest,
  sourceSelectionDigest: sourceProfiles.selectionDigest,
  sourceEvidenceDigest: sourceProfiles.evidenceDigest,
  sourceProfileProjectionDigest: sourceProfiles.projectionDigest,
  sourceRuleIndexDigest: legality.sourceRuleIndexDigest,
  legalEntryCount: legality.legalEntryCount,
  exclusionCount: legality.exclusionCount,
  legalEntryIds: legality.legalEntryIds,
  exclusions: legality.exclusions,
};
const nextLegality: CatalogSyntaxLegalityArtifact = {
  ...legalityCore,
  determinismDigest: sha256Canonical(legalityCore),
};

await Promise.all([
  writeFile(activeProfilesPath, `${JSON.stringify(nextActiveProfiles)}\n`, "utf8"),
  writeFile(legalityPath, `${JSON.stringify(nextLegality)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  reconstructedOldProfileCount,
  profileCount: nextActiveProfiles.profileCount,
  changedProfileIdCount,
  changedValencyProfileCount,
  changedEntryCount: changedEntryIds.size,
  removedAmbitransitiveCount,
  removedIntransitiveCount,
  addedValencyFrameCount,
  sourceSelectionDigest: nextActiveProfiles.sourceSelectionDigest,
  sourceEvidenceDigest: nextActiveProfiles.sourceEvidenceDigest,
  oldSourceProfileProjectionDigest: activeProfiles.sourceProfileProjectionDigest,
  newSourceProfileProjectionDigest: nextActiveProfiles.sourceProfileProjectionDigest,
  sourceRuleIndexDigest: nextActiveProfiles.sourceRuleIndexDigest,
  activeProfilesDeterminismDigest: nextActiveProfiles.determinismDigest,
  legalityDeterminismDigest: nextLegality.determinismDigest,
}));
