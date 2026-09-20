import { describe, expect, it } from "vitest";
import { summarizeLocativeSourceEvidence } from "../../scripts/locative-source-evidence.js";

const SOURCE = [
  "# sent_id = zai-verb",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t在\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t學校\t_\tNOUN\t_\t_\t2\tobj\t_\t_",
  "",
  "# sent_id = zai-oblique",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t在\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t學校\t_\tNOUN\t_\t_\t4\tobl\t_\t_",
  "4\t工作\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = copular-zai-case",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t是\t_\tAUX\t_\t_\t4\tcop\t_\t_",
  "3\t在\t_\tADP\t_\t_\t4\tcase\t_\t_",
  "4\t學校\t_\tNOUN\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = existential-you",
  "1\t學校\t_\tNOUN\t_\t_\t2\tobl\t_\t_",
  "2\t有\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t學生\t_\tNOUN\t_\t_\t2\tobj\t_\t_",
  "",
].join("\n");

describe("locative source evidence", () => {
  it("keeps verbal 在, oblique 在, and copular 在-case shapes separate", () => {
    const evidence = summarizeLocativeSourceEvidence([SOURCE]);

    expect(evidence.zaiTokenCount).toBe(3);
    expect(evidence.zaiUposCounts).toEqual({ ADP: 2, VERB: 1 });

    expect(evidence.zaiVerbTokenCount).toBe(1);
    expect(evidence.zaiVerbRootTokenCount).toBe(1);
    expect(evidence.zaiVerbWithSubjectTokenCount).toBe(1);
    expect(evidence.zaiVerbWithNominalComplementTokenCount).toBe(1);

    expect(evidence.zaiAdpCaseTokenCount).toBe(2);
    expect(evidence.zaiCaseObliqueHeadTokenCount).toBe(1);
    expect(evidence.predicateWithZaiObliqueTokenCount).toBe(1);
    expect(evidence.predicateWithZaiObliqueFormCounts).toEqual({ 工作: 1 });

    expect(evidence.zaiCaseRootHeadTokenCount).toBe(1);
    expect(evidence.zaiCaseHeadWithCopTokenCount).toBe(1);
    expect(evidence.zaiCaseHeadWithSubjectTokenCount).toBe(1);
    expect(evidence.zaiCaseHeadWithCopAndSubjectTokenCount).toBe(1);
  });

  it("tracks 有 separately instead of folding existential evidence into locative evidence", () => {
    const evidence = summarizeLocativeSourceEvidence([SOURCE]);
    expect(evidence.youVerbTokenCount).toBe(1);
    expect(evidence.youVerbRootTokenCount).toBe(1);
    expect(evidence.youVerbWithObjectTokenCount).toBe(1);
    expect(evidence.youVerbWithZaiObliqueTokenCount).toBe(0);
  });
});
