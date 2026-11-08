import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { projectCatalogEntryRuntimeProfiles, preserveRuntimeProfileOrder } from "../../src/syntax/runtime-profile-projection.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../../src/syntax/runtime-profiles.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const entry = (reading: string): CatalogEntry => ({
  id: catalogEntryId("嵌", reading), prompt: { text: "嵌", locale: "zh-TW" },
  syllables: [], tags: [], provenanceIds: [],
});
const source: RuntimeSyntaxProfile = {
  id: "source-profile", entryId: "source-entry", upos: "VERB",
  functions: ["complement", "unspecified"], valencyFrames: ["transitive"],
  dependencyEvidence: { dependencyRelationCounts: { xcomp: 1, parataxis: 1 },
    surfacePositionCounts: { medial: 2 } },
  provenanceIds: ["ud:test"],
};
const profiles = new Map([[source.id, source]]);
const sourceEntry = { entryId: source.entryId, text: "嵌", status: "indexed" as const, profileIds: [source.id] };

describe("source-profile projection precedes runtime reachability", () => {
  it("retains observed profiles even when the source index cannot reach a sentence yet", () => {
    const projected = projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), {
      ...sourceEntry, status: "no-reachable-sentence-rule",
    }, profiles);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ entryId: entry("ㄑㄧㄢ1").id,
      functions: source.functions, valencyFrames: source.valencyFrames,
      dependencyEvidence: source.dependencyEvidence, provenanceIds: source.provenanceIds });
  });

  it("binds the same written-form evidence to distinct reading identities without inventing roles", () => {
    const first = projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), sourceEntry, profiles)[0]!;
    const other = projectCatalogEntryRuntimeProfiles(entry("ㄎㄢ3"), sourceEntry, profiles)[0]!;
    expect(first.id).not.toBe(other.id);
    expect(first.upos).toBe(source.upos);
    expect(other.upos).toBe(source.upos);
    expect(projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), undefined, profiles)).toEqual([]);
    expect(projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), {
      ...sourceEntry, status: "no-ud-evidence", profileIds: [],
    }, profiles)).toEqual([]);
  });

  it("rejects mismatched written forms, missing source profiles, and foreign profile ownership", () => {
    expect(() => projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), {
      ...sourceEntry, text: "其他",
    }, profiles)).toThrow(/written form/);
    expect(() => projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), sourceEntry, new Map())).toThrow(/invalid syntax/);
    expect(() => projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), sourceEntry,
      new Map([[source.id, { ...source, entryId: "foreign" }]]))).toThrow(/invalid syntax/);
    expect(() => projectCatalogEntryRuntimeProfiles(entry("ㄑㄧㄢ1"), {
      ...sourceEntry, profileIds: [],
    }, profiles)).toThrow(/has no syntax profiles/);
  });

  it("appends a new reading without renumbering earlier profiles, rejecting hidden syntax changes", () => {
    const old = [{ ...source, id: "z-old" }, { ...source, id: "m-old" }];
    const core = { schemaVersion: "formal-syntax-active-catalog-profiles-v1" as const,
      grammarVersion: "mandarin-formal-grammar-v1", catalogEntryCount: 1, catalogDigest: "catalog",
      sourceSelectionDigest: "selection", sourceEvidenceDigest: "evidence",
      sourceProfileProjectionDigest: "projection", sourceProfileArtifactDigest: "artifact",
      sourceRuleIndexDigest: "index", profileCount: old.length, profiles: old };
    const previous: ActiveCatalogSyntaxProfilesArtifact = { ...core, determinismDigest: sha256Canonical(core) };
    const added = { ...source, id: "a-added" };
    expect(preserveRuntimeProfileOrder([added, ...[...old].reverse()], previous).map(p => p.id))
      .toEqual(["z-old", "m-old", "a-added"]);
    expect(() => preserveRuntimeProfileOrder([added, old[0]!], previous)).toThrow(/retain its identity/);
    expect(() => preserveRuntimeProfileOrder([{ ...old[0]!, upos: "ADJ" }, old[1]!, added], previous))
      .toThrow(/retain its identity/);
    expect(() => preserveRuntimeProfileOrder([...old, added], { ...previous, determinismDigest: "bad" }))
      .toThrow(/stale or invalid/);
  });
});
