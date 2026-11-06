import { describe, expect, it } from "vitest";
import { compareMoeRoleSupplement, compareMoeRoleSupplementFollowup, compareMoeExtendedRoles, FROZEN_SUPPLEMENT_BAD_SLOTS, FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS, FROZEN_EXTENDED_BAD_SLOTS } from "../../scripts/compare-moe-role-supplement.js";

function fixture(stage: boolean | "extended" = false) {
  const extended = stage === "extended";
  const followup = stage === true;
  const count = extended ? 4096 : 2048;
  const targets = extended ? FROZEN_EXTENDED_BAD_SLOTS : followup ? FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS : FROZEN_SUPPLEMENT_BAD_SLOTS;
  const sentences = Array.from({ length: count }, (_, seedIndex) => ({ seedIndex,
    text: "非", root: "sentence.declarative", entryIds: ["word:非:ㄈㄟ1"] as string[] }));
  for (const target of targets) {
    while (sentences[target.seed]!.entryIds.length <= target.slot) sentences[target.seed]!.entryIds.push("word:非:ㄈㄟ1");
    sentences[target.seed]!.entryIds[target.slot] = target.id;
  }
  const before = { readingEligibilityPolicy: extended ? "standard-role-supplement-followup-trial" : followup ? "standard-role-supplement-trial" : "standard-numeric-fen-trial", seedNamespace: "fixed",
    catalogEntryCount: 13692, sampleCount: count, successfulSentences: count, failedSentences: 0,
    sentences, hits: targets.map(row => ({ seedIndex: row.seed,
      entryIndex: row.slot, selectedEntryId: row.id, selectedUpos: row.upos })) };
  const after = { ...before, readingEligibilityPolicy: extended ? "standard-role-extended-trial" : followup ? "standard-role-supplement-followup-trial" : "standard-role-supplement-trial",
    sentences: sentences.map(s => ({ ...s, entryIds: s.entryIds.map((id, slot) =>
      targets.some(t => t.seed === s.seedIndex && t.slot === slot) ? "word:非:ㄈㄟ1" : id) })),
    hits: [] as { seedIndex: number; entryIndex: number; selectedEntryId: string; selectedUpos: string }[] };
  return { before, after };
}

describe("supplement source-population comparison", () => {
  it("requires all twenty-two reviewed slots and no collateral lexical changes", () => {
    const { before, after } = fixture();
    expect(compareMoeRoleSupplement(before, after)).toMatchObject({ incompatibleRoleUsesBefore: 22,
      incompatibleRoleUsesAfter: 0, changedSlotCount: 22, changedOutsideReviewedSlots: 0 });
    after.sentences[88]!.entryIds = ["word:外:ㄨㄞ4"];
    expect(() => compareMoeRoleSupplement(before, after)).toThrow(/outside frozen/);
  });
  it("rejects missed fixes and incompatible replacement readings", () => {
    const a = fixture();
    a.after.sentences[67]!.entryIds[1] = a.before.sentences[67]!.entryIds[1]!;
    expect(() => compareMoeRoleSupplement(a.before, a.after)).toThrow(/outside frozen/);
    const b = fixture();
    b.after.hits.push({ seedIndex: 88, entryIndex: 0, selectedEntryId: "word:親:ㄑㄧㄥ4", selectedUpos: "ADJ" });
    expect(() => compareMoeRoleSupplement(b.before, b.after)).toThrow(/mismatch remains/);
  });
  it("rejects stale source tuples, seed populations, roots and hidden text changes", () => {
    const a = fixture(); a.before.hits.pop();
    expect(() => compareMoeRoleSupplement(a.before, a.after)).toThrow(/source tuples/);
    const b = fixture(); b.after.seedNamespace = "other";
    expect(() => compareMoeRoleSupplement(b.before, b.after)).toThrow(/matching successful/);
    const c = fixture(); c.after.sentences[88]!.root = "other";
    expect(() => compareMoeRoleSupplement(c.before, c.after)).toThrow(/root/);
    const d = fixture(); d.after.sentences[88]!.text = "unreported";
    expect(() => compareMoeRoleSupplement(d.before, d.after)).toThrow(/text drift/);
  });
});

describe("later-stage comparison preserves the v1 population", () => {
  it("repairs exactly two later-stage slots and cannot reopen a v1 replacement", () => {
    const { before, after } = fixture(true);
    expect(compareMoeRoleSupplementFollowup(before, after)).toMatchObject({
      incompatibleRoleUsesBefore: 2, incompatibleRoleUsesAfter: 0, changedSlotCount: 2,
      changedOutsideReviewedSlots: 0, changedSeeds: [473, 1354],
    });
    after.sentences[67]!.entryIds = ["word:已:ㄧ3"];
    expect(() => compareMoeRoleSupplementFollowup(before, after)).toThrow(/outside frozen/);
  });
  it("rejects a missed later repair and source-policy mismatch", () => {
    const a = fixture(true); a.after.sentences[473]!.entryIds[0] = a.before.sentences[473]!.entryIds[0]!;
    expect(() => compareMoeRoleSupplementFollowup(a.before, a.after)).toThrow(/outside frozen/);
    const b = fixture(true); b.before.readingEligibilityPolicy = "standard-numeric-fen-trial";
    expect(() => compareMoeRoleSupplementFollowup(b.before, b.after)).toThrow(/matching successful/);
  });
});

describe("4,096-seed extended comparison", () => {
  it("checks every reviewed position in the second half", () => {
    const { before, after } = fixture("extended");
    expect(compareMoeExtendedRoles(before, after)).toMatchObject({ sampleCount: 4096,
      incompatibleRoleUsesBefore: 16, incompatibleRoleUsesAfter: 0,
      changedSlotCount: 16, changedOutsideReviewedSlots: 0 });
    after.sentences[3945]!.entryIds[1] = before.sentences[3945]!.entryIds[1]!;
    expect(() => compareMoeExtendedRoles(before, after)).toThrow(/outside frozen/);
  });
  it("rejects collateral changes at either end of the population", () => {
    const a = fixture("extended"); a.after.sentences[0]!.text = "unreported";
    expect(() => compareMoeExtendedRoles(a.before, a.after)).toThrow(/text drift/);
    const b = fixture("extended"); b.after.sentences[4095]!.entryIds = ["word:外:ㄨㄞ4"];
    expect(() => compareMoeExtendedRoles(b.before, b.after)).toThrow(/outside frozen/);
  });
  it("rejects truncated evidence and wrong reading/role replacements", () => {
    const a = fixture("extended"); a.after.sentences = a.after.sentences.slice(0, 2048);
    expect(() => compareMoeExtendedRoles(a.before, a.after)).toThrow(/4096-seed/);
    const b = fixture("extended"); b.after.hits.push({ seedIndex: 4095,
      entryIndex: 0, selectedEntryId: "word:與:ㄩ4", selectedUpos: "ADP" });
    expect(() => compareMoeExtendedRoles(b.before, b.after)).toThrow(/mismatch remains/);
  });
});
