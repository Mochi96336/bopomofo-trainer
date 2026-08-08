import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../../src/curriculum/formal-syntax-taxonomy.js";

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

describe("formal syntax effective product distribution", () => {
  it("keeps realized family shares bounded through the actual product composer", () => {
    const sampleCount = 64;
    const familyCounts = new Map<string, number>();
    let questions = 0;

    for (let round = 0; round < sampleCount; round += 1) {
      const composition = composeFormalSyntaxUtterances({
        eligibleEntries: PRACTICE_CATALOG,
        profiles: SYNTAX_PROFILES,
        random: createSeededRandom(`formal-family-product-distribution:${round}`),
        samplingMode: "product-family",
        minimumLexicalEntries: 2,
        maximumCandidates: 1,
        maximumAttempts: 64,
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
      expect(composition.candidates).toHaveLength(1);
      const candidate = composition.candidates[0]!;
      expect(candidate.syntaxRootRuleId).toBeDefined();
      const classification = sentenceConstructionClassification(candidate.syntaxRootRuleId!);
      expect(classification).not.toBeNull();
      increment(familyCounts, classification!.family);
      if (classification!.kind === "question") questions += 1;
    }

    const counts = Object.fromEntries([...familyCounts.entries()].sort());
    const aNotA = familyCounts.get("question.a-not-a") ?? 0;
    const aNotAShare = aNotA / sampleCount;
    const questionShare = questions / sampleCount;
    const diagnostic = JSON.stringify({ sampleCount, aNotAShare, questionShare, counts });

    // Guard both disappearance and renewed over-representation. These are
    // product-health bounds, not claims about natural Mandarin frequencies.
    expect(aNotAShare, diagnostic).toBeGreaterThan(0.015);
    expect(aNotAShare, diagnostic).toBeLessThan(0.12);
    expect(questionShare, diagnostic).toBeGreaterThan(0.12);
    expect(questionShare, diagnostic).toBeLessThan(0.40);
  });
});
