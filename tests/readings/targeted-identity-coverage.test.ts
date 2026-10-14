import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  buildPolyphonicIdentityTargets,
  classifyPolyphonicIdentityCoverage,
  type IdentityProbeOutcome,
} from "../../src/readings/targeted-identity-coverage.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄏ", "tone:2"] }],
    tags: [], provenanceIds: [],
  };
}
function profile(e: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: "profile:" + e.id + ":" + upos,
    entryId: e.id,
    upos,
    functions: ["subject"],
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}

describe("polyphonic exact reading-identity coverage", () => {
  const he2 = entry("和", "ㄏㄜ2");
  const huo4 = entry("和", "ㄏㄨㄛ4");
  const flower = entry("花", "ㄏㄨㄚ1");
  const source = [he2, huo4, flower];
  const profiles = [profile(he2, "CCONJ"), profile(huo4, "CCONJ"), profile(huo4, "VERB")];

  it("separates a denied role from a permitted alternate grammatical role", () => {
    const targets = buildPolyphonicIdentityTargets(source, profiles, { [he2.id]: 7 });
    expect(targets).toHaveLength(2);
    expect(targets.find(x => x.entryId === he2.id)?.baselineOccurrences).toBe(7);
    const alternative = targets.find(x => x.entryId === huo4.id)!;
    expect(alternative.baselineOccurrences).toBe(0);
    expect(alternative.profileCount).toBe(2);
    expect(alternative.rejectedProfileCount).toBe(1);
    expect(alternative.allowedUpos).toEqual(["VERB"]);
    expect(alternative.staticStatus).toBe("has-licensed-profile");
    expect(classifyPolyphonicIdentityCoverage(alternative, undefined)).toBe("not-probed");
    expect(classifyPolyphonicIdentityCoverage(alternative, {
      entryId: huo4.id, attempts: 3, generationsWithoutCandidate: 1, selectedExamples: [],
    })).toBe("not-observed-after-bounded-probes");
  });

  it("reports a licensed target with only denied profiles as a local role restriction", () => {
    const targets = buildPolyphonicIdentityTargets(source, profiles.slice(0, 2), {});
    const alternative = targets.find(x => x.entryId === huo4.id)!;
    expect(alternative.staticStatus).toBe("all-profiles-role-rejected");
    expect(classifyPolyphonicIdentityCoverage(alternative, undefined))
      .toBe("all-profiles-role-rejected");
  });

  it("does not classify an unprofiled reading as an observed grammar candidate", () => {
    const targets = buildPolyphonicIdentityTargets(source, [profile(he2, "CCONJ")], {});
    const alternative = targets.find(x => x.entryId === huo4.id)!;
    expect(alternative.staticStatus).toBe("no-runtime-profile");
    expect(classifyPolyphonicIdentityCoverage(alternative, undefined)).toBe("no-runtime-profile");
  });

  it("distinguishes unbiased observation from selected-only targeted examples", () => {
    const targets = buildPolyphonicIdentityTargets(source, profiles, { [he2.id]: 1 });
    const observed = targets.find(x => x.entryId === he2.id)!;
    const missing = targets.find(x => x.entryId === huo4.id)!;
    const result: IdentityProbeOutcome = {
      entryId: huo4.id,
      attempts: 2,
      generationsWithoutCandidate: 0,
      selectedExamples: [{
        seedIndex: 0, text: "這樣和", syntaxRootRuleId: "sentence.test",
        selectedProfileId: profiles[2]!.id, selectedUpos: "VERB",
        previousEntryText: "這樣", nextEntryText: null,
      }],
    };
    expect(classifyPolyphonicIdentityCoverage(observed, result))
      .toBe("observed-in-unbiased-sample");
    expect(classifyPolyphonicIdentityCoverage(missing, result))
      .toBe("observed-only-in-targeted-probe");
  });

  it("rejects invalid baselines and orphaned syntax profiles", () => {
    expect(() => buildPolyphonicIdentityTargets(source, profiles, { [huo4.id]: -1 }))
      .toThrow("invalid baseline occurrence");
    expect(() => buildPolyphonicIdentityTargets(source, [profile(entry("不存在", "ㄌㄧㄠ3"), "NOUN")], {}))
      .toThrow("unknown catalog entry");
  });
});
