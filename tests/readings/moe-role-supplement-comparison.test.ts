import { describe, expect, it } from "vitest";
import { compareMoeRoleSupplement, compareMoeRoleSupplementFollowup, FROZEN_SUPPLEMENT_BAD_SLOTS, FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS } from "../../scripts/compare-moe-role-supplement.js";

function fixture(followup = false) {
  const targets = followup ? FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS : FROZEN_SUPPLEMENT_BAD_SLOTS;
  const sentences = Array.from({ length: 2048 }, (_, seedIndex) => ({ seedIndex,
    text: "非", root: "sentence.declarative", entryIds: ["word:非:ㄈㄟ1"] as string[] }));
  for (const target of targets) {
    while (sentences[target.seed]!.entryIds.length <= target.slot) sentences[target.seed]!.entryIds.push("word:非:ㄈㄟ1");
    sentences[target.seed]!.entryIds[target.slot] = target.id;
  }
  const before = { readingEligibilityPolicy: followup ? "standard-role-supplement-trial" : "standard-numeric-fen-trial", seedNamespace: "fixed",
    catalogEntryCount: 13692, sampleCount: 2048, successfulSentences: 2048, failedSentences: 0,
    sentences, hits: targets.map(row => ({ seedIndex: row.seed,
      entryIndex: row.slot, selectedEntryId: row.id, selectedUpos: row.upos })) };
  const after = { ...before, readingEligibilityPolicy: followup ? "standard-role-supplement-followup-trial" : "standard-role-supplement-trial",
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
