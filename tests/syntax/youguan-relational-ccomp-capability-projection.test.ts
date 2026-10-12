import { describe, expect, it } from "vitest";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import {
  applyRuntimeOccurrenceCapabilityProjection,
  type RuntimeOccurrenceCapabilityProjectionArtifact,
} from "../../src/syntax/runtime-occurrence-capability-projection.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const sourceDigest = "source-profile-digest";
const ENTRY_ID = "word:有關:ㄧㄡ3-ㄍㄨㄢ1";

function profile(
  id: string,
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
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
    reviewedCapability: "relational-adjective-youguan-case-ccomp-same-occurrence" as const,
    evidenceContract: "same-root-youguan-case-ccomp-v1" as const,
    identityPolicy: "unique-active-entry-per-form-upos-v1" as const,
    profileCount: profileIds.length,
    entryCount: new Set(profileIds).size,
    profileIds,
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("有關 relational ccomp runtime capability projection", () => {
  it("projects only onto the reviewed 有關/ADJ predicate identity", () => {
    const adj = profile("youguan-adj", ENTRY_ID, "ADJ", ["predicate"], ["clausal-complement"]);
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [adj],
      sourceDigest,
      artifact([adj.id]),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual([
      "relational-adjective-youguan-case-ccomp-same-occurrence",
    ]);
  });

  it("rejects the same catalog entry's VERB profile", () => {
    const verb = profile(
      "youguan-verb",
      ENTRY_ID,
      "VERB",
      ["complement"],
      ["clausal-complement"],
    );
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [verb],
      sourceDigest,
      artifact([verb.id]),
    )).toThrow(/invalid profile identity/u);
  });

  it("rejects an unrelated ADJ even with aggregate predicate and ccomp evidence", () => {
    const unrelated = profile(
      "other-adj",
      "word:其他:ㄑㄧ2-ㄊㄚ1",
      "ADJ",
      ["predicate"],
      ["clausal-complement"],
    );
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [unrelated],
      sourceDigest,
      artifact([unrelated.id]),
    )).toThrow(/invalid profile identity/u);
  });

  it("rejects 有關/ADJ when aggregate backstop no longer includes predicate or ccomp", () => {
    const noPredicate = profile("no-predicate", ENTRY_ID, "ADJ", ["modifier"], ["clausal-complement"]);
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [noPredicate],
      sourceDigest,
      artifact([noPredicate.id]),
    )).toThrow(/invalid profile identity/u);

    const noCcomp = profile("no-ccomp", ENTRY_ID, "ADJ", ["predicate"], ["intransitive"]);
    expect(() => applyRuntimeOccurrenceCapabilityProjection(
      [noCcomp],
      sourceDigest,
      artifact([noCcomp.id]),
    )).toThrow(/invalid profile identity/u);
  });
});
