import { describe, expect, it } from "vitest";
import { summarizeCcompSourceEvidence } from "../../scripts/ccomp-source-evidence.js";

const SOURCE = [
  "# sent_id = matrix-nominal-subject",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t知道\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t你\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "4\t來\t_\tVERB\t_\t_\t2\tccomp\t_\t_",
  "",
  "# sent_id = matrix-clausal-subject-and-object",
  "1\t下雨\t_\tVERB\t_\t_\t3\tcsubj\t_\t_",
  "2\t事實\t_\tNOUN\t_\t_\t3\tobj\t_\t_",
  "3\t顯示\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "4\t會\t_\tAUX\t_\t_\t5\taux\t_\t_",
  "5\t淹水\t_\tVERB\t_\t_\t3\tccomp\t_\t_",
  "",
  "# sent_id = adjectival-governor-and-marker",
  "1\t很\t_\tADV\t_\t_\t2\tadvmod\t_\t_",
  "2\t確定\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "3\t說\t_\tPART\t_\t_\t4\tmark\t_\t_",
  "4\t成功\t_\tVERB\t_\t_\t2\tccomp\t_\t_",
  "",
].join("\n");

describe("ccomp source evidence", () => {
  it("measures ccomp heads and governors independently", () => {
    const evidence = summarizeCcompSourceEvidence([SOURCE]);
    expect(evidence.ccompTokenCount).toBe(3);
    expect(evidence.ccompHeadUposCounts).toEqual({ VERB: 3 });
    expect(evidence.governingHeadUposCounts).toEqual({ ADJ: 1, VERB: 2 });
  });

  it("keeps matrix and embedded subject realization separate", () => {
    const evidence = summarizeCcompSourceEvidence([SOURCE]);
    expect(evidence.embeddedWithOvertSubjectTokenCount).toBe(1);
    expect(evidence.embeddedWithoutOvertSubjectTokenCount).toBe(2);
    expect(evidence.governorWithSubjectTokenCount).toBe(2);
    expect(evidence.governorWithNominalSubjectTokenCount).toBe(1);
    expect(evidence.governorWithClausalSubjectTokenCount).toBe(1);
  });

  it("measures co-occurring arguments instead of assuming ccomp is an object slot", () => {
    const evidence = summarizeCcompSourceEvidence([SOURCE]);
    expect(evidence.governorWithObjectTokenCount).toBe(1);
    expect(evidence.governorWithoutObjectTokenCount).toBe(2);
    expect(evidence.ccompWithMarkChildTokenCount).toBe(1);
    expect(evidence.ccompWithoutMarkChildTokenCount).toBe(2);
  });
});
