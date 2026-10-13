import { describe, expect, it } from "vitest";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import {
  applyRuntimeOccurrenceCapabilityProjection,
  type RuntimeOccurrenceCapabilityProjectionArtifact,
} from "../../src/syntax/runtime-occurrence-capability-projection.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const sourceDigest = "source-profile-digest";

function profile(
  id: string,
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function artifact(profileIds: readonly string[]): RuntimeOccurrenceCapabilityProjectionArtifact {
  const core = {
    schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
    sourceProfileArtifactDigest: sourceDigest,
    sourceProvenanceId: "ud:chinese-gsd-r2.18",
    sourceVersion: "r2.18",
    sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
    reviewedCapability: "relational-adjective-youguan-case-marker-same-occurrence" as const,
    evidenceContract: "same-root-youguan-case-ccomp-v1" as const,
    identityPolicy: "unique-active-entry-per-form-upos-v1" as const,
    profileCount: profileIds.length,
    entryCount: profileIds.length,
    profileIds,
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("有關 relational case-marker runtime capability projection", () => {
  it("projects only onto reviewed ADP/adposition identities", () => {
    const yu = profile("yu-adp", "word:與:ㄩ3", "ADP", ["adposition"]);
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [yu],
      sourceDigest,
      artifact([yu.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual([
      "relational-adjective-youguan-case-marker-same-occurrence",
    ]);
  });

  it("rejects conjunction and non-adposition profiles", () => {
    const conjunction = profile("he-cconj", "word:和:ㄏㄜ2", "CCONJ", ["coordinator"]);
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [conjunction],
      sourceDigest,
      artifact([conjunction.id]),
    )).toThrow(/invalid profile identity/u);

    const noAdposition = profile("yu-adp-no-case", "word:與:ㄩ3", "ADP", ["modifier"]);
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [noAdposition],
      sourceDigest,
      artifact([noAdposition.id]),
    )).toThrow(/invalid profile identity/u);
  });
});
