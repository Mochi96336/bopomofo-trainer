import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import { reviewedMoeSupplementalRoleEligible, reviewedMoeSupplementFollowupRoleEligible, reviewedMoeExtendedRoleEligible, reviewedMoeQianRoleEligible } from "../../src/readings/moe-supplemental-role-license.js";

function eligible(text: string, reading: string, upos: Upos, policy = reviewedMoeSupplementalRoleEligible): boolean {
  const entry = { id: catalogEntryId(text, reading), prompt: { text, locale: "zh-TW" },
    syllables: [], tags: [], provenanceIds: [] } satisfies CatalogEntry;
  const profile: RuntimeSyntaxProfile = { id: "test/" + entry.id, entryId: entry.id,
    upos, functions: ["unspecified"], valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} }, provenanceIds: [] };
  return policy(entry, profile);
}

describe("qian readings after adding the missing standard identity", () => {
  it.each(["ㄎㄢ3", "ㄑㄧㄢ4"])("rejects %s only in the independent VERB role", reading => {
    expect(eligible("嵌", reading, "VERB", reviewedMoeExtendedRoleEligible)).toBe(true);
    expect(eligible("嵌", reading, "VERB", reviewedMoeQianRoleEligible)).toBe(false);
  });
  it.each([
    ["嵌", "ㄑㄧㄢ1", "VERB"], ["嵌", "ㄑㄧㄢ1", "ADJ"], ["嵌", "ㄑㄧㄢ4", "ADJ"],
    ["赤嵌樓", "ㄔ4-ㄎㄢ3-ㄌㄡ2", "NOUN"], ["藏", "ㄘㄤ2", "PROPN"], ["弟", "ㄊㄧ4", "NOUN"],
  ] as const)("preserves source-attested or whole-word %s/%s/%s", (text, reading, upos) => {
    expect(eligible(text, reading, upos, reviewedMoeQianRoleEligible)).toBe(true);
  });
  it("checks the actual selected identity", () => {
    expect(() => reviewedMoeQianRoleEligible({ id: catalogEntryId("嵌", "ㄎㄢ3") } as CatalogEntry,
      { entryId: catalogEntryId("嵌", "ㄑㄧㄢ1") } as RuntimeSyntaxProfile)).toThrow(/actual selected/);
  });
});

describe("source-backed supplemental roles", () => {
  it.each([
    ["爲", "ㄨㄟ4", "AUX", "ㄨㄟ2"],
    ["任", "ㄖㄣ2", "VERB", "ㄖㄣ4"],
    ["親", "ㄑㄧㄥ4", "ADJ", "ㄑㄧㄣ1"],
    ["將", "ㄑㄧㄤ1", "ADV", "ㄐㄧㄤ1"],
    ["於", "ㄨ1", "ADP", "ㄩ2"],
    ["般", "ㄅㄛ1", "ADJ", "ㄅㄢ1"],
    ["若", "ㄖㄜ3", "ADP", "ㄖㄨㄛ4"],
    ["遠", "ㄩㄢ4", "ADJ", "ㄩㄢ3"],
    ["相", "ㄒㄧㄤ4", "ADV", "ㄒㄧㄤ1"],
    ["中", "ㄓㄨㄥ4", "PART", "ㄓㄨㄥ1"],
    ["石", "ㄉㄢ4", "PROPN", "ㄕ2"],
    ["賈", "ㄍㄨ3", "PROPN", "ㄐㄧㄚ3"],
    ["馮", "ㄆㄧㄥ2", "PROPN", "ㄈㄥ2"],
    ["合", "ㄍㄜ3", "VERB", "ㄏㄜ2"],
    ["無", "ㄇㄛ2", "VERB", "ㄨ2"],
    ["彈", "ㄉㄢ4", "VERB", "ㄊㄢ2"],
    ["只", "ㄓ1", "ADV", "ㄓ3"],
    ["足", "ㄐㄩ4", "VERB", "ㄗㄨ2"],
  ] as const)("distinguishes %s readings in the independently reviewed role", (text, wrong, upos, valid) => {
    expect(eligible(text, wrong, upos)).toBe(false);
    expect(eligible(text, valid, upos)).toBe(true);
  });

  it.each([
    ["爲", "ㄨㄟ4", "ADP"], ["任", "ㄖㄣ2", "PROPN"], ["任", "ㄖㄣ2", "ADJ"],
    ["親", "ㄑㄧㄥ4", "NOUN"], ["將", "ㄑㄧㄤ1", "VERB"],
    ["於", "ㄨ1", "NOUN"], ["於", "ㄨ1", "INTJ"],
    ["遠", "ㄩㄢ4", "VERB"], ["遠", "ㄩㄢ4", "PART"],
    ["相", "ㄒㄧㄤ4", "NOUN"], ["相", "ㄒㄧㄤ4", "VERB"],
    ["中", "ㄓㄨㄥ4", "VERB"], ["那", "ㄋㄨㄛ2", "PRON"],
    ["曾", "ㄗㄥ1", "ADV"], ["行", "ㄒㄧㄥ2", "NOUN"],
    ["親家", "ㄑㄧㄥ4-ㄐㄧㄚ5", "NOUN"], ["般若", "ㄅㄛ1-ㄖㄜ3", "NOUN"],
    ["蘭若", "ㄌㄢ2-ㄖㄜ3", "NOUN"],
    ["石", "ㄉㄢ4", "NOUN"], ["賈", "ㄍㄨ3", "NOUN"], ["賈", "ㄍㄨ3", "VERB"],
    ["馮", "ㄆㄧㄥ2", "VERB"], ["馮", "ㄆㄧㄥ2", "ADV"],
    ["合", "ㄍㄜ3", "NOUN"], ["公合", "ㄍㄨㄥ1-ㄍㄜ3", "NOUN"],
    ["南無", "ㄋㄚ2-ㄇㄛ2", "NOUN"], ["彈", "ㄉㄢ4", "NOUN"],
    ["只", "ㄓ1", "NOUN"], ["祇", "ㄓ1", "ADV"], ["祗", "ㄓ1", "ADV"],
    ["足", "ㄐㄩ4", "ADV"], ["頡", "ㄒㄧㄝ2", "PROPN"],
    ["哈", "ㄏㄚ1", "PROPN"], ["作", "ㄗㄨㄛ1", "VERB"],
  ] as const)("preserves legitimate rare and unreviewed %s/%s/%s", (text, reading, upos) => {
    expect(eligible(text, reading, upos)).toBe(true);
  });

  it("rejects a profile belonging to a different selected identity", () => {
    const entry = { id: catalogEntryId("爲", "ㄨㄟ4") } as CatalogEntry;
    const profile = { entryId: catalogEntryId("爲", "ㄨㄟ2") } as RuntimeSyntaxProfile;
    expect(() => reviewedMoeSupplementalRoleEligible(entry, profile)).toThrow(/actual selected/);
  });
});

describe("follow-up source distinctions without changing the frozen v1 policy", () => {
  it.each([
    ["為", "ㄨㄟ4", "PROPN", "ㄨㄟ2"],
    ["好", "ㄏㄠ4", "ADV", "ㄏㄠ3"],
  ] as const)("rejects reviewed %s/%s/%s only in the later stage", (text, wrong, upos, valid) => {
    expect(eligible(text, wrong, upos)).toBe(true);
    expect(eligible(text, wrong, upos, reviewedMoeSupplementFollowupRoleEligible)).toBe(false);
    expect(eligible(text, valid, upos, reviewedMoeSupplementFollowupRoleEligible)).toBe(true);
  });

  it.each([
    ["為", "ㄨㄟ4", "ADP"], ["為", "ㄨㄟ4", "VERB"], ["為", "ㄨㄟ4", "ADV"],
    ["好", "ㄏㄠ4", "VERB"], ["好", "ㄏㄠ4", "NOUN"], ["好", "ㄏㄠ3", "VERB"],
    ["解", "ㄐㄧㄝ4", "NOUN"], ["強", "ㄑㄧㄤ3", "VERB"], ["強", "ㄑㄧㄤ3", "ADV"],
    ["強", "ㄑㄧㄤ3", "ADJ"], ["強", "ㄑㄧㄤ3", "NOUN"],
    ["好學", "ㄏㄠ4-ㄒㄩㄝ2", "ADJ"], ["愛好", "ㄞ4-ㄏㄠ4", "NOUN"],
  ] as const)("preserves source-attested or unreviewed %s/%s/%s", (text, reading, upos) => {
    expect(eligible(text, reading, upos, reviewedMoeSupplementFollowupRoleEligible)).toBe(true);
  });

  it("rejects a mismatched selected profile in the follow-up stage", () => {
    const entry = { id: catalogEntryId("好", "ㄏㄠ4") } as CatalogEntry;
    const profile = { entryId: catalogEntryId("好", "ㄏㄠ3") } as RuntimeSyntaxProfile;
    expect(() => reviewedMoeSupplementFollowupRoleEligible(entry, profile)).toThrow(/actual selected/);
  });
});

describe("extended source-backed reading/role distinctions", () => {
  it.each([
    ["與", "ㄩ4", "ADP", "ㄩ3"], ["處", "ㄔㄨ4", "VERB", "ㄔㄨ3"],
    ["讀", "ㄉㄡ4", "VERB", "ㄉㄨ2"], ["食", "ㄙ4", "NOUN", "ㄕ2"],
    ["洗", "ㄒㄧㄢ3", "VERB", "ㄒㄧ3"], ["哈", "ㄏㄚ3", "PROPN", "ㄏㄚ1"],
    ["曾", "ㄘㄥ2", "PROPN", "ㄗㄥ1"], ["任", "ㄖㄣ4", "PROPN", "ㄖㄣ2"],
    ["親", "ㄑㄧㄥ4", "VERB", "ㄑㄧㄣ1"], ["合", "ㄍㄜ3", "PROPN", "ㄏㄜ2"],
    ["大", "ㄉㄞ4", "ADV", "ㄉㄚ4"],
  ] as const)("distinguishes reviewed %s readings in %s/%s", (text, wrong, upos, valid) => {
    expect(eligible(text, wrong, upos, reviewedMoeSupplementFollowupRoleEligible)).toBe(true);
    expect(eligible(text, wrong, upos, reviewedMoeExtendedRoleEligible)).toBe(false);
    expect(eligible(text, valid, upos, reviewedMoeExtendedRoleEligible)).toBe(true);
  });

  it.each([
    ["與", "ㄩ4", "VERB"], ["與", "ㄩ2", "PART"], ["處", "ㄔㄨ4", "NOUN"],
    ["處", "ㄔㄨ3", "PROPN"], ["處", "ㄔㄨ3", "ADJ"],
    ["讀", "ㄉㄡ4", "NOUN"], ["句讀", "ㄐㄩ4-ㄉㄡ4", "NOUN"],
    ["食", "ㄙ4", "VERB"], ["食", "ㄧ4", "PROPN"],
    ["洗", "ㄒㄧㄢ3", "NOUN"], ["洗", "ㄒㄧㄢ3", "PROPN"],
    ["哈巴", "ㄏㄚ3-ㄅㄚ1", "ADJ"], ["曾", "ㄘㄥ2", "ADV"], ["曾", "ㄘㄥ2", "ADJ"],
    ["曾", "ㄗㄥ1", "ADV"], ["任", "ㄖㄣ4", "NOUN"], ["任", "ㄖㄣ4", "VERB"],
    ["任", "ㄖㄣ4", "ADV"], ["任", "ㄖㄣ2", "ADJ"],
    ["親家", "ㄑㄧㄥ4-ㄐㄧㄚ5", "NOUN"], ["合", "ㄍㄜ3", "NOUN"],
    ["公合", "ㄍㄨㄥ1-ㄍㄜ3", "NOUN"], ["稱", "ㄔㄥ4", "VERB"],
    ["稱", "ㄔㄣ4", "NOUN"], ["解", "ㄐㄧㄝ4", "NOUN"],
    ["大夫", "ㄉㄞ4-ㄈㄨ5", "NOUN"],
  ] as const)("preserves legitimate rare or whole-word %s/%s/%s", (text, reading, upos) => {
    expect(eligible(text, reading, upos, reviewedMoeExtendedRoleEligible)).toBe(true);
  });

  it("rejects a mismatched selected profile rather than borrowing its reading", () => {
    const entry = { id: catalogEntryId("處", "ㄔㄨ4") } as CatalogEntry;
    const profile = { entryId: catalogEntryId("處", "ㄔㄨ3") } as RuntimeSyntaxProfile;
    expect(() => reviewedMoeExtendedRoleEligible(entry, profile)).toThrow(/actual selected/);
  });
  it("rejects the incompatible 大 replacement instead of stopping at the original 與", () => {
    expect(eligible("大", "ㄉㄞ4", "ADP", reviewedMoeExtendedRoleEligible)).toBe(false);
  });
});
