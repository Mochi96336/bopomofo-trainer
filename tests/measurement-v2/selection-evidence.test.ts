import { describe, expect, it } from "vitest";
import { appendSelectionEvidence, parseSelectionEvidence, type RecentSelectionEvidence } from "../../src/measurement-v2/selection-evidence.js";

describe("bounded selection evidence", () => {
  it("forgets old errors and retains only accepted timing samples", () => {
    let evidence: RecentSelectionEvidence | undefined;
    evidence = appendSelectionEvidence(evidence, false, null);
    for (let index = 0; index < 40; index += 1) {
      evidence = appendSelectionEvidence(evidence, true, 100 + index);
    }
    expect(evidence.correctness).toEqual(Array<boolean>(32).fill(true));
    expect(evidence.timingMs).toEqual(Array.from({ length: 24 }, (_, i) => 116 + i));
    expect(parseSelectionEvidence(JSON.parse(JSON.stringify(evidence)))).toEqual(evidence);
  });

  it("rejects malformed and unbounded imported evidence", () => {
    for (const value of [null, {}, { correctness: [1], timingMs: [] },
      { correctness: [], timingMs: [NaN] }, { correctness: [], timingMs: [-1] },
      { correctness: Array(33).fill(true), timingMs: [] },
      { correctness: [], timingMs: Array(25).fill(100) }]) {
      expect(parseSelectionEvidence(value)).toBeNull();
    }
  });
});
