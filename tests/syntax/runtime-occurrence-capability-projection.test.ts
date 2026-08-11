import { describe, expect, it } from "vitest";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import {
  applyRuntimeOccurrenceCapabilityProjection,
  type RuntimeOccurrenceCapabilityProjectionArtifact,
} from "../../src/syntax/runtime-occurrence-capability-projection.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const sourceDigest = "source-profile-digest";
const supported: RuntimeSyntaxProfile = {
  id: "supported",
  entryId: "entry:supported",
  upos: "VERB",
  functions: [],
  valencyFrames: ["clausal-complement"],
  dependencyEvidence: {
    dependencyRelationCounts: { ccomp: 1 },
    surfacePositionCounts: {},
    morphologicalFeatureCounts: { "Voice=Cau": 1 },
  },
  provenanceIds: [],
};
const aggregateOnly: RuntimeSyntaxProfile = {
  ...supported,
  id: "aggregate-only",
  entryId: "entry:aggregate-only",
};

function artifact(profileIds: readonly string[]): RuntimeOccurrenceCapabilityProjectionArtifact {
  const core = {
    schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
    sourceProfileArtifactDigest: sourceDigest,
    sourceProvenanceId: "ud:chinese-gsd-r2.18",
    sourceVersion: "r2.18",
    sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
    reviewedCapability: "voice-cau-ccomp-same-occurrence" as const,
    evidenceContract: "same-token-voice-cau-direct-ccomp-v1" as const,
    identityPolicy: "unique-active-entry-per-form-upos-v1" as const,
    profileCount: profileIds.length,
    entryCount: profileIds.length,
    profileIds,
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("runtime occurrence capability sidecar", () => {
  it("adds the reviewed capability only to explicitly targeted profiles", () => {
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [supported, aggregateOnly],
      sourceDigest,
      artifact([supported.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual(["voice-cau-ccomp-same-occurrence"]);
    expect(projected[1]?.occurrenceCapabilities).toBeUndefined();
  });

  it("rejects a sidecar tied to another source-profile artifact", () => {
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [supported],
      "different-digest",
      artifact([supported.id]),
    )).toThrow(/stale or invalid/u);
  });

  it("rejects targets that do not retain both aggregate source dimensions", () => {
    const missingCcomp: RuntimeSyntaxProfile = { ...supported, valencyFrames: [] };
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [missingCcomp],
      sourceDigest,
      artifact([missingCcomp.id]),
    )).toThrow(/invalid profile identity/u);
  });
});
