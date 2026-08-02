import { describe, expect, it } from "vitest";
import {
  guardStratumOutput,
  metadataIntegrityDigest,
  verdictProgress,
  type VerdictProgress,
} from "../../scripts/catalog-qa-command-core.js";

describe("catalog QA metadata integrity", () => {
  const metadata = {
    schema: "catalog-qa-sample-v5",
    seed: "catalog-qa-1",
    catalogEntryCount: 13897,
    sampleSize: 259,
    strata: { support: { catalog: { covered: 100 }, sampled: { covered: 25 } } },
    drawnAt: "2026-08-02T18:53:50.514Z",
  };

  it("covers counts, strata and draw time, not only the inner manifest", () => {
    const digest = metadataIntegrityDigest(metadata);
    expect(metadataIntegrityDigest({ ...metadata, catalogEntryCount: 13898 })).not.toBe(digest);
    expect(metadataIntegrityDigest({ ...metadata, sampleSize: 260 })).not.toBe(digest);
    expect(metadataIntegrityDigest({
      ...metadata,
      strata: { support: { catalog: { covered: 101 }, sampled: { covered: 25 } } },
    })).not.toBe(digest);
    expect(metadataIntegrityDigest({ ...metadata, drawnAt: "later" })).not.toBe(digest);
  });

  it("does not include its own digest field", () => {
    expect(metadataIntegrityDigest({ ...metadata, integrityDigest: "old" }))
      .toBe(metadataIntegrityDigest({ ...metadata, integrityDigest: "new" }));
  });
});

describe("catalog QA verdict completeness", () => {
  it("counts blank and unsure rows as unresolved", () => {
    const progress = verdictProgress([
      { reading_verdict: "ok" },
      { reading_verdict: "wrong" },
      { reading_verdict: "" },
      { reading_verdict: "unsure" },
    ], "reading_verdict");
    expect(progress).toEqual({
      total: 4,
      blank: 1,
      unsure: 1,
      unresolved: 2,
      complete: false,
    });
  });
});

describe("catalog QA stratum output guard", () => {
  const complete: VerdictProgress = {
    total: 4,
    blank: 0,
    unsure: 0,
    unresolved: 0,
    complete: true,
  };
  const incomplete: VerdictProgress = {
    total: 4,
    blank: 1,
    unsure: 1,
    unresolved: 2,
    complete: false,
  };
  const output = [
    "sheet and metadata agree",
    "## reading",
    "  catalog rate  5.0%",
    "  by stratum (uniform within each level):",
    "    readingSupport",
    "      covered                 5.0%",
    "## grammar role",
    "  catalog rate  10.0%",
    "  by stratum (uniform within each level):",
    "    grammarEvidence",
    "      weak-1-2               10.0%",
  ].join("\n");

  it("keeps a valid headline but withholds incomplete localisation", () => {
    const guarded = guardStratumOutput(output, {
      reading_verdict: incomplete,
      role_verdict: complete,
    });
    expect(guarded).toContain("catalog rate  5.0%");
    expect(guarded).toContain("by stratum: not reportable -- 2 of 4 rows are unresolved");
    expect(guarded).not.toContain("readingSupport");
    expect(guarded).toContain("grammarEvidence");
    expect(guarded).toContain("weak-1-2               10.0%");
  });

  it("leaves fully resolved output unchanged", () => {
    expect(guardStratumOutput(output, {
      reading_verdict: complete,
      role_verdict: complete,
    })).toBe(output);
  });
});
