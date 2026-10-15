import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DongxiUdCorpus } from "../../src/readings/dongxi-ud-intake.js";
import {
  buildDongxiUdTrainReviewQueue, validateDongxiUdTrainReviewQueue,
} from "../../src/readings/dongxi-ud-review-queue.js";

const source = JSON.parse(readFileSync(
  "data/readings/dongxi-ud-gsd-attested-review-candidates.json", "utf8",
)) as DongxiUdCorpus;
const packet = JSON.parse(readFileSync(
  "data/readings/dongxi-ud-gsd-train-review-queue.json", "utf8",
)) as unknown;

describe("東西 independent-review train queue is not gold or held-out", () => {
  it("has exactly six source TRAIN cases with all judgments pending", () => {
    const generated = buildDongxiUdTrainReviewQueue(source);
    expect(generated).toEqual(packet);
    expect(validateDongxiUdTrainReviewQueue(packet, source)).toEqual({
      sourceTrainCases: 6,
      pendingIndependentReviews: 6,
      approvedGoldLabels: 0,
    });
    expect(generated.cases.map(c => c.sourceId)).toEqual(
      source.candidates.filter(c => c.split === "train").map(c => c.id),
    );
    for (const c of generated.cases) {
      expect(c.sentence.slice(c.targetUtf16Offset, c.targetUtf16Offset + 2)).toBe("東西");
      expect(Object.values(c.review)).toEqual(Array(4).fill("pending"));
    }
  });

  it("does not leak dev/test or original sense/reading guesses into reviewer packet", () => {
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toMatch(/ud-gsd-(dev|test)-s\d+/);
    expect(serialized).not.toContain("ud-gsd-train-s816");
    for (const marker of [
      "preliminarySenseProposal", "proposalStatus", "sourceReadingAnnotation",
      "directions", "objects", "ㄉㄨㄥ", "Translit=dōngxi",
      "eligibleForTraining\":true",
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  it("fails closed on extra answer fields or an altered sentence", () => {
    const extra = structuredClone(packet) as {
      cases: Array<Record<string, unknown>>;
      approvedGoldLabels: number;
    };
    extra.cases[0]!.suggestedReading = "ㄉㄨㄥ1 ㄒㄧ5";
    expect(() => validateDongxiUdTrainReviewQueue(extra, source)).toThrow("unapproved judgment");
    delete extra.cases[0]!.suggestedReading;
    extra.approvedGoldLabels = 1;
    expect(() => validateDongxiUdTrainReviewQueue(extra, source)).toThrow("unapproved judgment");
    extra.approvedGoldLabels = 0;
    extra.cases[0]!.sentence = "更改過的東西";
    expect(() => validateDongxiUdTrainReviewQueue(extra, source)).toThrow("unapproved judgment");
  });

  it("fails closed on split leakage and source token/position corruption", () => {
    const leaked = structuredClone(packet) as { cases: Array<Record<string, unknown>> };
    const dev = source.candidates.find(c => c.split === "dev")!;
    leaked.cases.push({
      sourceId: dev.id,
      sourceTokenId: dev.lexicalSourceToken.id,
      target: "東西",
      targetUtf16Offset: dev.sentence.indexOf("東西"),
      sentence: dev.sentence,
      review: {},
    });
    expect(() => validateDongxiUdTrainReviewQueue(leaked, source)).toThrow("unapproved judgment");

    const shifted = structuredClone(packet) as { cases: Array<Record<string, unknown>> };
    shifted.cases[0]!.sourceTokenId = 999;
    expect(() => validateDongxiUdTrainReviewQueue(shifted, source)).toThrow("unapproved judgment");
    shifted.cases[0]!.sourceTokenId = source.candidates[0]!.lexicalSourceToken.id;
    shifted.cases[0]!.targetUtf16Offset = 0;
    expect(() => validateDongxiUdTrainReviewQueue(shifted, source)).toThrow("unapproved judgment");
  });
});
