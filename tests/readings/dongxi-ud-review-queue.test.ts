import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DongxiUdCorpus } from "../../src/readings/dongxi-ud-intake.js";
import {
  buildDongxiUdTrainReviewQueue, validateDongxiUdTrainReviewQueue,
  validateDongxiUdReviewerHandout,
  PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA,
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

  it("rejects coordinated upstream-intake and reviewer-packet sentence edits", () => {
    const tamperedSource = structuredClone(source) as unknown as { candidates: Array<{
      sentence: string;
    }> };
    const tamperedPacket = structuredClone(packet) as { cases: Array<{
      sentence: string;
      targetUtf16Offset: number;
    }> };
    const altered = "有了這些東西，人類生存了。";
    tamperedSource.candidates[0]!.sentence = altered;
    tamperedPacket.cases[0]!.sentence = altered;
    tamperedPacket.cases[0]!.targetUtf16Offset = altered.indexOf("東西");
    expect(() => validateDongxiUdTrainReviewQueue(
      tamperedPacket, tamperedSource as unknown as DongxiUdCorpus,
    )).toThrow("pinned UD source sentence/token facts");
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

describe("reviewer-facing Markdown is actually the audited source projection", () => {
  const handout = readFileSync(
    "docs/reviewer-packets/dongxi-gsd-train-independent-review-form.md", "utf8",
  );

  it("pins the complete reviewer-facing document, not just recognizable keywords", () => {
    const sha = (text: string) => createHash("sha1")
      .update(`blob ${Buffer.byteLength(text, "utf8")}\0`)
      .update(text, "utf8").digest("hex");
    expect(sha(handout)).toBe(PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA);
    const hinted = handout + "\n補充提示：R02 的正確詞義是方位。\n";
    // Sentence extraction/keyword heuristics alone would accept this hint.
    expect(validateDongxiUdReviewerHandout(hinted, source).sourceMatches).toBe(6);
    expect(sha(hinted)).not.toBe(PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA);
  });

  it("does not give reviewers forced-choice sense or tone categories", () => {
    expect(handout).not.toMatch(/方位\\s*[／/|]\\s*事物|第一聲\\s*[／/|]\\s*輕聲|第二音節一聲\\s*[／/|]\\s*第二音節輕聲/u);
    expect(handout).toContain("你的實際讀法（完整注音或不適用）");
  });

  it("preserves six exact train sentences in order, without source metadata", () => {
    expect(validateDongxiUdReviewerHandout(handout, source)).toEqual({
      reviewerCases: 6, sourceMatches: 6, approvedGoldLabels: 0,
    });
  });

  it("rejects a changed sentence, altered order, or a missing case", () => {
    expect(() => validateDongxiUdReviewerHandout(
      handout.replace("有了這兩東西", "有了這兩樣東西"), source,
    )).toThrow("sentence text/order");
    expect(() => validateDongxiUdReviewerHandout(
      handout.replace("## R06", "## R16"), source,
    )).toThrow("sentence text/order");
    expect(() => validateDongxiUdReviewerHandout(
      handout.replace("## R06", "## REMOVED"), source,
    )).toThrow("exactly the six");
  });

  it("rejects dev/test content and source/answer hints in handouts", () => {
    const dev = source.candidates.find(c => c.split === "dev")!;
    expect(() => validateDongxiUdReviewerHandout(
      handout + "\n" + dev.sentence, source,
    )).toThrow("dev/test");
    expect(() => validateDongxiUdReviewerHandout(
      handout + "\nsourceTokenId: 5", source,
    )).toThrow("source metadata");
    expect(() => validateDongxiUdReviewerHandout(
      handout + "\nㄉㄨㄥ1 ㄒㄧ5", source,
    )).toThrow("reading hints");
  });
});
