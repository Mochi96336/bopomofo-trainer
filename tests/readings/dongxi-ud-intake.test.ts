import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateDongxiUdIntake, type DongxiUdCorpus,
} from "../../src/readings/dongxi-ud-intake.js";

const source = JSON.parse(readFileSync(
  "data/readings/dongxi-ud-gsd-attested-review-candidates.json", "utf8",
)) as DongxiUdCorpus;
const copy = (): DongxiUdCorpus => structuredClone(source);

describe("pinned attested UD 東西 candidate intake", () => {
  it("keeps ten real standalone-token hits and rejects substring-only 東西向", () => {
    const report = validateDongxiUdIntake(source);
    expect(report.independentlyTokenizedOccurrences).toBe(10);
    expect(report.splitCounts).toEqual({ train: 6, dev: 3, test: 1 });
    expect(report.hypothesisCounts).toEqual({ directions: 5, objects: 5 });
    expect(report.excludedCompoundSubstringCount).toBe(1);
    expect(source.candidates.some(x => x.sentId === "train-s816")).toBe(false);
  });

  it("cannot treat hypotheses and source transliteration as approved readings", () => {
    const report = validateDongxiUdIntake(source);
    expect(report.sourceReadingDisambiguated).toBe(false);
    expect(report.reviewedCorrectReadingLabels).toBe(0);
    expect(report.modelTrainingReady).toBe(false);
    expect(report.productionActivationReady).toBe(false);
    for (const row of source.candidates) {
      expect(row.sourceReadingAnnotation).toBe("not-disambiguated-in-UD-translit");
      expect(row.review.contextualReading).toBe("pending");
      expect(row.eligibleForTraining).toBe(false);
    }
    const tainted = copy() as unknown as { candidates: Array<Record<string, unknown>> };
    tainted.candidates[0]!.eligibleForTraining = true;
    expect(() => validateDongxiUdIntake(tainted as unknown as DongxiUdCorpus))
      .toThrow("cannot promote");
    tainted.candidates[0]!.eligibleForTraining = false;
    tainted.candidates[0]!.review = {
      naturalness: "pending", contextualSense: "approved",
      contextualReading: "pending",
      tokenization: "source-UD-token-attested-not-independently-reviewed",
    };
    expect(() => validateDongxiUdIntake(tainted as unknown as DongxiUdCorpus))
      .toThrow("cannot promote");
  });

  it("rejects coupled source/packet drift even when item counts and source IDs still match", () => {
    const mutated = copy() as unknown as { candidates: Array<{
      sentence: string;
      lexicalSourceToken: { id: number; deprel: string };
    }> };
    // Previously this would satisfy the structural intake validator: one exact
    // 東西 token, same source ID and split, and all reviews still pending.
    mutated.candidates[0]!.sentence = "有了這些東西，人類生存了。";
    expect(() => validateDongxiUdIntake(mutated as unknown as DongxiUdCorpus))
      .toThrow("pinned UD source sentence/token facts");

    mutated.candidates[0]!.sentence = source.candidates[0]!.sentence;
    mutated.candidates[0]!.lexicalSourceToken.id = 4;
    expect(() => validateDongxiUdIntake(mutated as unknown as DongxiUdCorpus))
      .toThrow("pinned UD source sentence/token facts");

    mutated.candidates[0]!.lexicalSourceToken.id = source.candidates[0]!.lexicalSourceToken.id;
    mutated.candidates[0]!.lexicalSourceToken.deprel = "nmod";
    expect(() => validateDongxiUdIntake(mutated as unknown as DongxiUdCorpus))
      .toThrow("pinned UD source sentence/token facts");
  });

  it("rejects duplicates, split leakage and fake standalone tokenization", () => {
    const duplicates = copy() as unknown as { candidates: Array<Record<string, unknown>> };
    duplicates.candidates[1]!.id = duplicates.candidates[0]!.id;
    expect(() => validateDongxiUdIntake(duplicates as unknown as DongxiUdCorpus))
      .toThrow("source sentence ID");

    const mismatch = copy() as unknown as { candidates: Array<Record<string, unknown>> };
    mismatch.candidates[0]!.split = "test";
    expect(() => validateDongxiUdIntake(mismatch as unknown as DongxiUdCorpus))
      .toThrow("source sentence ID");

    const substring = copy() as unknown as { candidates: Array<Record<string, unknown>> };
    substring.candidates[0]!.lexicalSourceToken = {
      id: 5, form: "東西向", upos: "NOUN", deprel: "obj", translit: "dōngxi",
    };
    expect(() => validateDongxiUdIntake(substring as unknown as DongxiUdCorpus))
      .toThrow("independently tokenized");

    const control = copy() as unknown as { excludedSourceSubstringCases: Array<Record<string, unknown>> };
    control.excludedSourceSubstringCases[0]!.form = "東西";
    expect(() => validateDongxiUdIntake(control as unknown as DongxiUdCorpus))
      .toThrow("must not be mistaken");
  });
});
