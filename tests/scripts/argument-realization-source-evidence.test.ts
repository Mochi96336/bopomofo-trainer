import { describe, expect, it } from "vitest";
import {
  ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT,
  summarizeArgumentRealizationSourceEvidence,
} from "../../scripts/argument-realization-source-evidence.js";

function sentence(lines: readonly string[]): string {
  return `${lines.join("\n")}\n\n`;
}

function token(
  id: number,
  form: string,
  upos: string,
  head: number,
  relation: string,
): string {
  return [id, form, "_", upos, "_", "_", head, relation, "_", "_"].join("\t");
}

describe("argument realization source evidence", () => {
  it("keeps overt/absent realization on predicate occurrences instead of lexical valency", () => {
    const source = [
      sentence([
        token(1, "我", "PRON", 2, "nsubj"),
        token(2, "吃", "VERB", 0, "root"),
        token(3, "飯", "NOUN", 2, "obj"),
      ]),
      sentence([
        token(1, "他", "PRON", 2, "nsubj"),
        token(2, "吃", "VERB", 0, "root"),
        token(3, "麵", "NOUN", 2, "obj"),
      ]),
      sentence([token(1, "吃", "VERB", 0, "root")]),
      sentence([token(1, "吃", "VERB", 0, "root")]),
      sentence([
        token(1, "他", "PRON", 2, "nsubj"),
        token(2, "走", "VERB", 0, "root"),
      ]),
      sentence([token(1, "走", "VERB", 0, "root")]),
    ].join("");

    const evidence = summarizeArgumentRealizationSourceEvidence([source]);
    expect(evidence.contract).toBe(ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT);
    expect(evidence.verbOccurrenceCount).toBe(6);
    expect(evidence.verbFormCount).toBe(2);

    const eat = evidence.forms.find((item) => item.form === "吃");
    expect(eat).toMatchObject({
      verbOccurrenceCount: 4,
      subjectOvertCount: 2,
      subjectAbsentCount: 2,
      directObjectOvertCount: 2,
      directObjectAbsentCount: 2,
      subjectAlternationObserved: true,
      subjectAlternationReviewedFrontier: true,
      directObjectAlternationObserved: true,
      directObjectAlternationReviewedFrontier: true,
    });

    const walk = evidence.forms.find((item) => item.form === "走");
    expect(walk).toMatchObject({
      verbOccurrenceCount: 2,
      subjectOvertCount: 1,
      subjectAbsentCount: 1,
      directObjectOvertCount: 0,
      directObjectAbsentCount: 2,
      subjectAlternationObserved: true,
      subjectAlternationReviewedFrontier: false,
      directObjectAlternationObserved: false,
      directObjectAlternationReviewedFrontier: false,
    });

    expect(evidence.subjectAlternationObservedFormCount).toBe(2);
    expect(evidence.subjectAlternationReviewedFrontierFormCount).toBe(1);
    expect(evidence.directObjectAlternationObservedFormCount).toBe(1);
    expect(evidence.directObjectAlternationReviewedFrontierFormCount).toBe(1);
    expect(evidence.bothReviewedFrontiersFormCount).toBe(1);
  });
});
