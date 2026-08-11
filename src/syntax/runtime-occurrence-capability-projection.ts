import { sha256Canonical } from "../reference/importers/canonical-json.js";
import type { RuntimeOccurrenceCapability, RuntimeSyntaxProfile } from "./types.js";
import { validRuntimeOccurrenceCapabilities } from "./runtime-occurrence-capabilities.js";

export interface RuntimeOccurrenceCapabilityProjectionArtifact {
  readonly schemaVersion: "runtime-occurrence-capability-projection-v1";
  readonly sourceProfileArtifactDigest: string;
  readonly sourceProvenanceId: string;
  readonly sourceVersion: string;
  readonly sourceCommit: string;
  readonly reviewedCapability: RuntimeOccurrenceCapability;
  readonly evidenceContract: "same-token-voice-cau-direct-ccomp-v1";
  readonly identityPolicy: "unique-active-entry-per-form-upos-v1";
  readonly profileCount: number;
  readonly entryCount: number;
  readonly profileIds: readonly string[];
  readonly determinismDigest: string;
}

function hasRequiredAggregateInputs(profile: RuntimeSyntaxProfile): boolean {
  return (profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0
    && profile.valencyFrames.includes("clausal-complement");
}

/**
 * Join a small reviewed same-occurrence sidecar onto the independently generated
 * runtime profiles. This keeps the multi-fact occurrence claim out of both the
 * aggregate morphology projection and the aggregate valency projection.
 */
export function applyRuntimeOccurrenceCapabilityProjection(
  profiles: readonly RuntimeSyntaxProfile[],
  sourceProfileArtifactDigest: string,
  artifact: RuntimeOccurrenceCapabilityProjectionArtifact,
): readonly RuntimeSyntaxProfile[] {
  const { determinismDigest, ...core } = artifact;
  if (artifact.schemaVersion !== "runtime-occurrence-capability-projection-v1"
    || artifact.sourceProfileArtifactDigest !== sourceProfileArtifactDigest
    || artifact.sourceProvenanceId.length === 0
    || artifact.sourceVersion.length === 0
    || !/^[0-9a-f]{40}$/u.test(artifact.sourceCommit)
    || !validRuntimeOccurrenceCapabilities([artifact.reviewedCapability])
    || artifact.evidenceContract !== "same-token-voice-cau-direct-ccomp-v1"
    || artifact.identityPolicy !== "unique-active-entry-per-form-upos-v1"
    || artifact.profileCount !== artifact.profileIds.length
    || determinismDigest !== sha256Canonical(core)) {
    throw new Error("runtime occurrence capability projection artifact is stale or invalid");
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const targetedProfileIds = new Set<string>();
  const targetedEntryIds = new Set<string>();
  for (const profileId of artifact.profileIds) {
    if (targetedProfileIds.has(profileId)) {
      throw new Error("runtime occurrence capability projection contains duplicate profile identities");
    }
    const profile = profilesById.get(profileId);
    if (profile === undefined || !hasRequiredAggregateInputs(profile)) {
      throw new Error("runtime occurrence capability projection targets an invalid profile identity");
    }
    targetedProfileIds.add(profileId);
    targetedEntryIds.add(profile.entryId);
  }
  if (targetedEntryIds.size !== artifact.entryCount) {
    throw new Error("runtime occurrence capability projection entry count is stale");
  }

  return profiles.map((profile) => {
    if (profile.occurrenceCapabilities !== undefined) {
      throw new Error("runtime source profile already contains occurrence capability evidence");
    }
    return targetedProfileIds.has(profile.id)
      ? { ...profile, occurrenceCapabilities: [artifact.reviewedCapability] }
      : profile;
  });
}
