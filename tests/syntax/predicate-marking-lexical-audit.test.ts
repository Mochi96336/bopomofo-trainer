import { describe, expect, it } from "vitest";
import { auditPredicateMarkingLexicalGates } from "../../scripts/predicate-marking-lexical-audit.js";

describe("predicate marking lexical gate audit", () => {
  it("pins the active negation and aspect lexical frontiers", () => {
    const audit = auditPredicateMarkingLexicalGates();

    expect(audit.slotRequirements.negation).toEqual({
      allowedUpos: ["ADV", "AUX", "PART", "VERB"],
      requiredFunctions: [],
      requiredFeatures: { polarity: "negative" },
    });
    expect(audit.reachableProfiles.negation).toMatchObject({
      profileCount: 8,
      entryCount: 6,
    });
    expect(new Set(audit.reachableProfiles.negation.texts)).toEqual(
      new Set(["不", "未", "別", "沒", "非", "無"]),
    );

    expect(audit.slotRequirements.aspect).toEqual({
      allowedUpos: ["AUX", "PART"],
      requiredFunctions: [],
      requiredFeatures: { aspect: "marked" },
    });
    expect(audit.reachableProfiles.aspect).toMatchObject({
      profileCount: 3,
      entryCount: 3,
    });
    expect(new Set(audit.reachableProfiles.aspect.texts)).toEqual(
      new Set(["了", "著", "過"]),
    );
  });

  it("proves the Predicate modal migration dropped the legacy auxiliary gate", () => {
    const audit = auditPredicateMarkingLexicalGates();

    expect(audit.slotRequirements.modal).toEqual({
      allowedUpos: ["AUX"],
      requiredFunctions: [],
      requiredFeatures: {},
    });
    expect(audit.slotRequirements.legacyClauseModal).toEqual({
      allowedUpos: ["AUX"],
      requiredFunctions: ["auxiliary"],
      requiredFeatures: {},
    });
    expect(audit.reachableProfiles.predicateModalCurrent).toMatchObject({
      profileCount: 62,
      entryCount: 62,
    });
    expect(audit.reachableProfiles.legacyClauseModal).toMatchObject({
      profileCount: 48,
      entryCount: 48,
    });
    expect(audit.modalComparison).toMatchObject({
      legacyIsSubsetOfPredicate: true,
      leakedProfileCount: 14,
      leakedEntryCount: 14,
      leakedFunctionSignatureCounts: { copula: 14 },
      legacyMissingProfileCount: 0,
      legacyMissingTexts: [],
    });
    expect(new Set(audit.modalComparison.leakedTexts)).toEqual(new Set([
      "不是", "以為", "只是", "正是", "而是", "更為", "或是",
      "便是", "是", "是否", "就是", "爲", "還是",
    ]));
  });

  it("does not mistake the legacy auxiliary gate for a complete modality contract", () => {
    const audit = auditPredicateMarkingLexicalGates();
    const legacyTexts = new Set(audit.reachableProfiles.legacyClauseModal.texts);

    // These are independently licensed by aspect/passive constructions. Their
    // presence in the old AUX+auxiliary frontier proves that restoring the old
    // function gate alone would still not establish lexical modality.
    expect(legacyTexts.has("了")).toBe(true);
    expect(legacyTexts.has("著")).toBe(true);
    expect(legacyTexts.has("過")).toBe(true);
    expect(legacyTexts.has("被")).toBe(true);
  });
});
