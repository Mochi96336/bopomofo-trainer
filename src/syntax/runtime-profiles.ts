import type { CatalogEntry } from "../core/model.js";
import { sha256Canonical } from "../reference/importers/canonical-json.js";
import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import { validRuntimeMorphologicalFeatureCounts } from "./runtime-morphology.js";
import type { RuntimeSyntaxProfile } from "./types.js";

export interface RuntimeMorphologyProjectionLineage {
  readonly schemaVersion: "runtime-morphology-projection-v1";
  readonly sourceProvenanceId: string;
  readonly sourceVersion: string;
  readonly sourceCommit: string;
  readonly reviewedFeature: string;
  readonly identityPolicy: "unique-active-entry-per-form-upos-v1";
}

export interface ActiveCatalogSyntaxProfilesArtifact {
  readonly schemaVersion: "formal-syntax-active-catalog-profiles-v1";
  readonly grammarVersion: string;
  readonly catalogEntryCount: number;
  readonly catalogDigest: string;
  readonly sourceSelectionDigest: string;
  readonly sourceEvidenceDigest: string;
  readonly sourceProfileProjectionDigest: string;
  readonly sourceProfileArtifactDigest: string;
  readonly sourceRuleIndexDigest: string;
  readonly runtimeMorphologyProjection?: RuntimeMorphologyProjectionLineage;
  readonly profileCount: number;
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly determinismDigest: string;
}

function validCountMap(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRuntimeMorphologyProjectionLineage(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const lineage = value as Record<string, unknown>;
  return lineage.schemaVersion === "runtime-morphology-projection-v1"
    && typeof lineage.sourceProvenanceId === "string"
    && lineage.sourceProvenanceId.length > 0
    && typeof lineage.sourceVersion === "string"
    && lineage.sourceVersion.length > 0
    && typeof lineage.sourceCommit === "string"
    && /^[0-9a-f]{40}$/u.test(lineage.sourceCommit)
    && typeof lineage.reviewedFeature === "string"
    && lineage.reviewedFeature.length > 0
    && lineage.identityPolicy === "unique-active-entry-per-form-upos-v1";
}

function validProfile(profile: RuntimeSyntaxProfile): boolean {
  const morphology = profile.dependencyEvidence?.morphologicalFeatureCounts;
  return typeof profile.id === "string"
    && profile.id.length > 0
    && typeof profile.entryId === "string"
    && profile.entryId.length > 0
    && typeof profile.upos === "string"
    && Array.isArray(profile.functions)
    && Array.isArray(profile.valencyFrames)
    // Same-occurrence capabilities are owned by their small reviewed sidecar,
    // never embedded into this aggregate source-profile artifact.
    && profile.occurrenceCapabilities === undefined
    && Array.isArray(profile.provenanceIds)
    && typeof profile.dependencyEvidence === "object"
    && profile.dependencyEvidence !== null
    && validCountMap(profile.dependencyEvidence.dependencyRelationCounts)
    && validCountMap(profile.dependencyEvidence.surfacePositionCounts)
    // v1 active profiles predate runtime morphology. Missing means no reviewed
    // evidence; present maps must satisfy the explicit runtime allowlist.
    && validRuntimeMorphologicalFeatureCounts(morphology);
}

/**
 * Validate the committed compact profile source independently from the current
 * grammar's legality decision. Grammar evolution may make a previously legal
 * catalog entry unreachable; that must not make its source profile artifact
 * unreadable before the new legality set can be recomputed.
 */
export function loadActiveCatalogSyntaxProfilesArtifact(
  entries: readonly CatalogEntry[],
  artifact: ActiveCatalogSyntaxProfilesArtifact,
): readonly RuntimeSyntaxProfile[] {
  const { determinismDigest, ...core } = artifact;
  const hasRuntimeMorphology = artifact.profiles.some(
    (profile) => profile.dependencyEvidence?.morphologicalFeatureCounts !== undefined,
  );
  const morphologyLineage = artifact.runtimeMorphologyProjection;
  if (artifact.schemaVersion !== "formal-syntax-active-catalog-profiles-v1"
    || artifact.grammarVersion !== FORMAL_GRAMMAR_VERSION
    || artifact.catalogEntryCount !== entries.length
    || artifact.catalogDigest !== sha256Canonical(entries)
    || artifact.profileCount !== artifact.profiles.length
    || (morphologyLineage !== undefined && !validRuntimeMorphologyProjectionLineage(morphologyLineage))
    || (hasRuntimeMorphology && morphologyLineage === undefined)
    || determinismDigest !== sha256Canonical(core)) {
    throw new Error("active catalog syntax profiles artifact is stale or invalid");
  }
  const catalogEntryIds = new Set(entries.map((entry) => entry.id));
  const profileIds = new Set<string>();
  for (const profile of artifact.profiles) {
    if (!validProfile(profile)
      || profileIds.has(profile.id)
      || !catalogEntryIds.has(profile.entryId)) {
      throw new Error("active catalog syntax profiles contain an invalid identity");
    }
    profileIds.add(profile.id);
  }
  return artifact.profiles;
}

/** Fail-closed compatibility helper for callers that already own a legality set. */
export function applyActiveCatalogSyntaxProfilesArtifact(
  entries: readonly CatalogEntry[],
  legalEntryIds: ReadonlySet<string>,
  artifact: ActiveCatalogSyntaxProfilesArtifact,
): readonly RuntimeSyntaxProfile[] {
  const profiles = loadActiveCatalogSyntaxProfilesArtifact(entries, artifact);
  const profiledEntryIds = new Set<string>();
  for (const profile of profiles) {
    if (!legalEntryIds.has(profile.entryId)) {
      throw new Error("active catalog syntax profiles contain an invalid identity");
    }
    profiledEntryIds.add(profile.entryId);
  }
  if (legalEntryIds.size !== profiledEntryIds.size
    || [...legalEntryIds].some((entryId) => !profiledEntryIds.has(entryId))) {
    throw new Error("active catalog syntax profiles do not cover every legal entry");
  }
  return profiles;
}
