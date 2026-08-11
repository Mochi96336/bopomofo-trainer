import { describe, expect, it } from "vitest";
import { classifyRuntimeMorphologyIdentityMatches } from "../../scripts/runtime-morphology-identity.js";

describe("runtime morphology identity projection", () => {
  it("allows multiple runtime profiles when one source key resolves to one catalog entry", () => {
    const result = classifyRuntimeMorphologyIdentityMatches([
      { sourceKey: "讓\u0000VERB", entryId: "word:讓:reading-a" },
      { sourceKey: "讓\u0000VERB", entryId: "word:讓:reading-a" },
    ], new Set(["讓\u0000VERB"]));

    expect([...result.matchedSourceKeys]).toEqual(["讓\u0000VERB"]);
    expect([...result.ambiguousSourceKeys]).toEqual([]);
    expect([...result.activatableSourceKeys]).toEqual(["讓\u0000VERB"]);
  });

  it("fails closed when form plus UPOS spans multiple reading-specific entries", () => {
    const result = classifyRuntimeMorphologyIdentityMatches([
      { sourceKey: "長\u0000VERB", entryId: "word:長:reading-a" },
      { sourceKey: "長\u0000VERB", entryId: "word:長:reading-b" },
    ], new Set(["長\u0000VERB"]));

    expect([...result.matchedSourceKeys]).toEqual(["長\u0000VERB"]);
    expect([...result.ambiguousSourceKeys]).toEqual(["長\u0000VERB"]);
    expect([...result.activatableSourceKeys]).toEqual([]);
  });

  it("ignores active catalog identities with no pinned source evidence", () => {
    const result = classifyRuntimeMorphologyIdentityMatches([
      { sourceKey: "做\u0000VERB", entryId: "word:做:reading-a" },
    ], new Set(["讓\u0000VERB"]));

    expect([...result.matchedSourceKeys]).toEqual([]);
    expect([...result.ambiguousSourceKeys]).toEqual([]);
    expect([...result.activatableSourceKeys]).toEqual([]);
  });
});
