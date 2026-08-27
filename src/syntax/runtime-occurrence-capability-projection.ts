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

function validateArtifact(
  sourceProfileArtifactDigest: string,
  artifact: RuntimeOccurrenceCapabilityProjectionArtifact,
): void {
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
}

function applyReviewedProjection(
  profiles: readonly RuntimeSyntaxProfile[],
  sourceProfileArtifactDigest: string,
  artifact: RuntimeOccurrenceCapabilityProjectionArtifact,
  allowPreviouslyProjectedCapabilities: boolean,
): readonly RuntimeSyntaxProfile[] {
  validateArtifact(sourceProfileArtifactDigest, artifact);

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
    const existing = profile.occurrenceCapabilities;
    if (!allowPreviouslyProjectedCapabilities && existing !== undefined) {
      throw new Error("runtime source profile already contains occurrence capability evidence");
    }
    if (existing !== undefined && !validRuntimeOccurrenceCapabilities(existing)) {
      throw new Error("runtime profile contains invalid occurrence capability evidence");
    }
    if (!targetedProfileIds.has(profile.id)) return profile;
    if (existing?.includes(artifact.reviewedCapability) === true) {
      throw new Error("runtime occurrence capability projection duplicates a reviewed capability");
    }
    const occurrenceCapabilities = [...(existing ?? []), artifact.reviewedCapability].sort();
    return { ...profile, occurrenceCapabilities };
  });
}

/**
 * Join one reviewed same-occurrence sidecar onto clean independently generated
 * runtime profiles. A pre-populated capability list is rejected so callers do
 * not accidentally treat embedded aggregate data as reviewed sidecar evidence.
 */
export function applyRuntimeOccurrenceCapabilityProjection(
  profiles: readonly RuntimeSyntaxProfile[],
  sourceProfileArtifactDigest: string,
  artifact: RuntimeOccurrenceCapabilityProjectionArtifact,
): readonly RuntimeSyntaxProfile[] {
  return applyReviewedProjection(profiles, sourceProfileArtifactDigest, artifact, false);
}

/**
 * Compose multiple independently reviewed sidecars against the same immutable
 * source-profile artifact. Each artifact is still validated separately and may
 * only add its own reviewed capability; capabilities accumulated from earlier
 * sidecars are preserved rather than reconstructed from aggregate evidence.
 */
export function applyRuntimeOccurrenceCapabilityProjections(
  profiles: readonly RuntimeSyntaxProfile[],
  sourceProfileArtifactDigest: string,
  artifacts: readonly RuntimeOccurrenceCapabilityProjectionArtifact[],
): readonly RuntimeSyntaxProfile[] {
  if (profiles.some((profile) => profile.occurrenceCapabilities !== undefined)) {
    throw new Error("runtime source profile already contains occurrence capability evidence");
  }
  let projected = profiles;
  for (const artifact of artifacts) {
    projected = applyReviewedProjection(
      projected,
      sourceProfileArtifactDigest,
      artifact,
      true,
    );
  }
  return projected;
}
