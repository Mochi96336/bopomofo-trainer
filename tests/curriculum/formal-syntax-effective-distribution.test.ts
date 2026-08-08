import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { createFormalSyntaxFamilyRuleOrderer } from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { sentenceConstructionClassification } from "../../src/curriculum/formal-syntax-taxonomy.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../../src/syntax/realize.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

function isPracticeLexicalSlot(slot: StructuralLexicalSlot): boolean {
  return slot.formalLiteral === undefined
    && !(slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT");
}

describe("formal syntax effective product distribution", () => {
  it("keeps A-not-A bounded after real-catalog reachability and product length filtering", () => {
    const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
    const orderer = createFormalSyntaxFamilyRuleOrderer();
    const sampleCount = 128;
    const familyCounts = new Map<string, number>();
    let questions = 0;
    let totalAttempts = 0;

    for (let round = 0; round < sampleCount; round += 1) {
      const random = createSeededRandom(`formal-family-distribution:${round}`);
      let acceptedRootRuleId: string | null = null;
      for (let attempt = 0; attempt < 64 && acceptedRootRuleId === null; attempt += 1) {
        totalAttempts += 1;
        const shape = sampleStructuralDerivation({
          rootCategory: "Sentence",
          rules: FORMAL_SYNTAX_RULES,
          random,
          maximumAttempts: 1,
          ruleOrderer: orderer,
          isLexicalSlotReachable: (slot) => {
            if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
            return compatibleProfilesForSlot(slot, index).length > 0;
          },
          bounds: {
            maximumPhraseDepth: 3,
            maximumClauseNesting: 1,
            maximumClausesPerSentence: 2,
            maximumCoordinationItems: 2,
            maximumConsecutiveModifiers: 2,
            maximumComplementsPerPredicate: 1,
            maximumLexicalEntriesPerUtterance: 6,
          },
        });
        if (shape === null) continue;
        if (shape.lexicalSlots.filter(isPracticeLexicalSlot).length < 2) continue;
        acceptedRootRuleId = shape.root.productionRuleId;
      }

      expect(acceptedRootRuleId).not.toBeNull();
      const classification = sentenceConstructionClassification(acceptedRootRuleId!);
      expect(classification).not.toBeNull();
      familyCounts.set(
        classification!.family,
        (familyCounts.get(classification!.family) ?? 0) + 1,
      );
      if (classification!.kind === "question") questions += 1;
    }

    const counts = Object.fromEntries([...familyCounts.entries()].sort());
    const aNotA = familyCounts.get("question.a-not-a") ?? 0;
    const aNotAShare = aNotA / sampleCount;
    const questionShare = questions / sampleCount;
    const diagnostic = JSON.stringify({
      sampleCount,
      totalAttempts,
      averageAttempts: totalAttempts / sampleCount,
      aNotAShare,
      questionShare,
      counts,
    });
    expect(aNotAShare, diagnostic).toBeLessThan(0.12);
    expect(questionShare, diagnostic).toBeLessThan(0.40);
  });
});
