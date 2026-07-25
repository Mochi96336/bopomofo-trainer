import { describe, expect, it } from "vitest";
import {
  applyCommonnessProjection,
  catalogEntryFrequencyWeight,
} from "../../src/commonness/catalog-projection.js";
import { projectCommonness } from "../../src/commonness/project.js";
import type { CatalogEntry } from "../../src/core/model.js";

function entry(id: string): CatalogEntry {
  return {
    id,
    prompt: { text: id, locale: "zh-TW" },
    syllables: [],
        tags: ["fixture"],
    provenanceIds: ["fixture"],
  };
}

describe("catalog commonness projection", () => {
  it("applies reviewed evidence and weighs unmeasured entries evenly", () => {
    const projection = projectCommonness([
      {
        catalogEntryId: "high",
        catalogText: "high",
        sourceId: "naer:general-frequency",
        sourceVersion: "fixture-v1",
        sourceRowId: "1",
        spokenPerMillion: 100,
        writtenPerMillion: 100,
        identityStatus: "reviewed",
      },
      {
        catalogEntryId: "unused",
        catalogText: "unused",
        sourceId: "naer:general-frequency",
        sourceVersion: "fixture-v1",
        sourceRowId: "2",
        spokenPerMillion: 10,
        writtenPerMillion: 10,
        identityStatus: "reviewed",
      },
    ]);
    const applied = applyCommonnessProjection([
      entry("high"),
      entry("fallback"),
    ], projection);
    expect(applied.appliedEntryIds).toEqual(["high"]);
    expect(applied.unusedProjectionEntryIds).toEqual(["unused"]);
    expect(catalogEntryFrequencyWeight(applied.entries[0]!)).toBe(1);
    expect(catalogEntryFrequencyWeight(applied.entries[1]!)).toBe(1);
  });
});
