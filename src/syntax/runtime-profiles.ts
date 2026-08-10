import type { CatalogEntry } from "../core/model.js";
import { sha256Canonical } from "../reference/importers/canonical-json.js";
import { FORMAL_GRAMMAR_VERSION } from "./features.js";
import type { RuntimeSyntaxProfile } from "./types.js";

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
  readonly profileCount: number;
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly determinismDigest: string;
}

function validProfile(profile: RuntimeSyntaxProfile): boolean {
  return typeof profile.id === "string"
    && profile.id.length > 0
    && typeof profile.entryId === "string"
    && profile.entryId.length > 0
    && typeof profile.upos === "string"
    && Array.isArray(profile.functions)
    && Array.isArray(profile.valencyFrames)
    && Array.isArray(profile.provenanceIds)
    && typeof profile.dependencyEvidence === "object"
    && profile.dependencyEvidence !== null
    && typeof profile.dependencyEvidence.dependencyRelationCounts === "object"
    && typeof profile.dependencyEvidence.surfacePositionCounts === "object"
    && typeof profile.dependencyEvidence.morphologicalFeatureCounts === "object";
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
  if (artifact.schemaVersion !== "formal-syntax-active-catalog-profiles-v1"
    || artifact.grammarVersion !== FORMAL_GRAMMAR_VERSION
    || artifact.catalogEntryCount !== entries.length
    || artifact.catalogDigest !== sha256Canonical(entries)
    || artifact.profileCount !== artifact.profiles.length
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