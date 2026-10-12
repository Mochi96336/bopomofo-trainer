import { describe, expect, it } from "vitest";
import {
  summarizeYouguanRelationalCcompSourceEvidence,
} from "../../scripts/youguan-relational-ccomp-source-evidence.js";

const SOURCE = [
  "# sent_id = reviewed",
  "1\t問題\t_\tNOUN\t_\t_\t5\tnsubj\t_\t_",
  "2\t與\t_\tADP\t_\t_\t4\tcase\t_\t_",
  "3\t水平\t_\tNOUN\t_\t_\t4\tnsubj\t_\t_",
  "4\t低\t_\tADJ\t_\t_\t5\tccomp\t_\t_",
  "5\t有關\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = modifier",
  "1\t有關\t_\tADJ\t_\t_\t2\tamod\t_\t_",
  "2\t部門\t_\tNOUN\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = root-without-ccomp",
  "1\t故事\t_\tNOUN\t_\t_\t3\tnsubj\t_\t_",
  "2\t題材\t_\tNOUN\t_\t_\t3\tnmod\t_\t_",
  "3\t有關\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = wrong-case",
  "1\t問題\t_\tNOUN\t_\t_\t5\tnsubj\t_\t_",
  "2\t因為\t_\tADP\t_\t_\t4\tcase\t_\t_",
  "3\t情況\t_\tNOUN\t_\t_\t4\tnsubj\t_\t_",
  "4\t差\t_\tADJ\t_\t_\t5\tccomp\t_\t_",
  "5\t有關\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("有關 relational ccomp source evidence", () => {
  it("measures the lexical identity separately from the reviewed occurrence signature", () => {
    const evidence = summarizeYouguanRelationalCcompSourceEvidence([SOURCE]);
    expect(evidence.targetOccurrenceCount).toBe(4);
    expect(evidence.targetRelationCounts).toEqual({ amod: 1, root: 3 });
    expect(evidence.targetWithDirectCcompCount).toBe(2);
    expect(evidence.reviewedSignatureCount).toBe(1);
  });

  it("requires root + preposed direct ccomp + 與/和 case on the same occurrence", () => {
    const evidence = summarizeYouguanRelationalCcompSourceEvidence([SOURCE]);
    expect(evidence.reviewedCaseFormCounts).toEqual({ 與: 1 });
    expect(evidence.reviewedCcompHeadUposCounts).toEqual({ ADJ: 1 });
    expect(evidence.reviewedWithMatrixSubjectCount).toBe(1);
    expect(evidence.reviewedWithEmbeddedSubjectCount).toBe(1);
  });

  it("does not license modifier uses or root uses without the reviewed relation", () => {
    const evidence = summarizeYouguanRelationalCcompSourceEvidence([SOURCE]);
    expect(evidence.targetWithoutDirectCcompCount).toBe(2);
    expect(evidence.reviewedOccurrences).toHaveLength(1);
    expect(evidence.reviewedOccurrences[0]).toMatchObject({
      ccompForm: "低",
      ccompUpos: "ADJ",
      caseForm: "與",
    });
  });
});
