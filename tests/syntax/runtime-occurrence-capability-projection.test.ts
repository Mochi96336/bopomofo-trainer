import { describe, expect, it } from "vitest";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import {
  applyRuntimeOccurrenceCapabilityProjection,
  applyRuntimeOccurrenceCapabilityProjections,
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
const baOnly: RuntimeSyntaxProfile = {
  ...supported,
  id: "ba-only",
  entryId: "entry:ba-only",
  upos: "NOUN",
  valencyFrames: [],
  dependencyEvidence: {
    dependencyRelationCounts: {},
    surfacePositionCounts: {},
    morphologicalFeatureCounts: {},
  },
};
const shortPassiveOnly: RuntimeSyntaxProfile = {
  ...supported,
  id: "short-passive-only",
  entryId: "entry:short-passive-only",
  valencyFrames: [],
  dependencyEvidence: {
    dependencyRelationCounts: {},
    surfacePositionCounts: {},
    morphologicalFeatureCounts: {},
  },
};

function causativeArtifact(profileIds: readonly string[]): RuntimeOccurrenceCapabilityProjectionArtifact {
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

function baArtifact(profileIds: readonly string[]): RuntimeOccurrenceCapabilityProjectionArtifact {
  const core = {
    schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
    sourceProfileArtifactDigest: sourceDigest,
    sourceProvenanceId: "ud:chinese-gsd-r2.18",
    sourceVersion: "r2.18",
    sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
    reviewedCapability: "ba-obl-patient-case-same-occurrence" as const,
    evidenceContract: "same-predicate-obl-patient-case-ba-v1" as const,
    identityPolicy: "unique-active-entry-per-form-upos-v1" as const,
    profileCount: profileIds.length,
    entryCount: profileIds.length,
    profileIds,
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

function shortPassiveArtifact(profileIds: readonly string[]): RuntimeOccurrenceCapabilityProjectionArtifact {
  const core = {
    schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
    sourceProfileArtifactDigest: sourceDigest,
    sourceProvenanceId: "ud:chinese-gsd-r2.18",
    sourceVersion: "r2.18",
    sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
    reviewedCapability: "short-passive-aux-pass-bei-same-occurrence" as const,
    evidenceContract: "same-predicate-aux-pass-bei-v1" as const,
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
      causativeArtifact([supported.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual(["voice-cau-ccomp-same-occurrence"]);
    expect(projected[1]?.occurrenceCapabilities).toBeUndefined();
  });

  it("accepts reviewed BA targets without reconstructing BA from generic aggregate frames", () => {
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [baOnly],
      sourceDigest,
      baArtifact([baOnly.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual(["ba-obl-patient-case-same-occurrence"]);
  });

  it("accepts reviewed short-passive targets without a generic transitivity backstop", () => {
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [shortPassiveOnly],
      sourceDigest,
      shortPassiveArtifact([shortPassiveOnly.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual([
      "short-passive-aux-pass-bei-same-occurrence",
    ]);
  });

  it("composes independently reviewed capabilities without discarding earlier projections", () => {
    const projected = applyRuntimeOccurrenceCapabilityProjections(
      [supported],
      sourceDigest,
      [
        causativeArtifact([supported.id]),
        baArtifact([supported.id]),
        shortPassiveArtifact([supported.id]),
      ],
    );

    expect(projected[0]?.occurrenceCapabilities).toEqual([
      "ba-obl-patient-case-same-occurrence",
      "short-passive-aux-pass-bei-same-occurrence",
      "voice-cau-ccomp-same-occurrence",
    ]);
  });

  it("rejects duplicate capability projection onto the same profile", () => {
    expect(() => applyRuntimeOccurrenceCapabilityProjections(
      [baOnly],
      sourceDigest,
      [baArtifact([baOnly.id]), baArtifact([baOnly.id])],
    )).toThrow(/duplicates a reviewed capability/u);
  });

  it("keeps the single-sidecar entry point strict about clean source profiles", () => {
    const prepopulated: RuntimeSyntaxProfile = {
      ...supported,
      occurrenceCapabilities: ["voice-cau-ccomp-same-occurrence"],
    };
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [prepopulated],
      sourceDigest,
      causativeArtifact([]),
    )).toThrow(/source profile already contains/u);
  });

  it("rejects a sidecar tied to another source-profile artifact", () => {
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [supported],
      "different-digest",
      causativeArtifact([supported.id]),
    )).toThrow(/stale or invalid/u);
  });

  it("keeps the causative aggregate backstop on its reviewed contract", () => {
    const missingCcomp: RuntimeSyntaxProfile = { ...supported, valencyFrames: [] };
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [missingCcomp],
      sourceDigest,
      causativeArtifact([missingCcomp.id]),
    )).toThrow(/invalid profile identity/u);
  });
});
