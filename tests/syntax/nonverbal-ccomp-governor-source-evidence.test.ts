import { describe, expect, it } from "vitest";
import {
  summarizeNonverbalCcompGovernorSourceEvidence,
} from "../../scripts/nonverbal-ccomp-governor-source-evidence.js";

const SOURCE = [
  "# sent_id = adjective",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t高興\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "3\t你\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "4\t來\t_\tVERB\t_\t_\t2\tccomp\t_\t_",
  "",
  "# sent_id = nominal-copular",
  "1\t問題\t_\tNOUN\t_\t_\t0\troot\t_\t_",
  "2\t是\t_\tAUX\t_\t_\t1\tcop\t_\t_",
  "3\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "4\t走\t_\tVERB\t_\t_\t1\tccomp\t_\t_",
  "",
  "# sent_id = verbal-control",
  "1\t知道\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "2\t他\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "3\t走\t_\tVERB\t_\t_\t1\tccomp\t_\t_",
  "",
].join("\n");

describe("non-verbal ccomp governor source evidence", () => {
  it("isolates non-VERB governors from the full ccomp inventory", () => {
    const evidence = summarizeNonverbalCcompGovernorSourceEvidence([SOURCE]);
    expect(evidence.totalCcompTokenCount).toBe(3);
    expect(evidence.nonverbalGovernorTokenCount).toBe(2);
    expect(evidence.governorUposCounts).toEqual({ ADJ: 1, NOUN: 1 });
  });

  it("keeps root, subject, and copula shape separate by UPOS", () => {
    const evidence = summarizeNonverbalCcompGovernorSourceEvidence([SOURCE]);
    expect(evidence.governorRootUposCounts).toEqual({ ADJ: 1, NOUN: 1 });
    expect(evidence.governorWithSubjectUposCounts).toEqual({ ADJ: 1 });
    expect(evidence.governorWithoutSubjectUposCounts).toEqual({ NOUN: 1 });
    expect(evidence.governorWithCopulaUposCounts).toEqual({ NOUN: 1 });
  });

  it("retains review context without projecting it into grammar", () => {
    const evidence = summarizeNonverbalCcompGovernorSourceEvidence([SOURCE]);
    expect(evidence.occurrences).toHaveLength(2);
    expect(evidence.occurrences[0]).toMatchObject({
      governorForm: "高興",
      governorUpos: "ADJ",
      governorIsRoot: true,
      ccompForm: "來",
    });
    expect(evidence.occurrences[1]).toMatchObject({
      governorForm: "問題",
      governorUpos: "NOUN",
      hasCopulaChild: true,
    });
  });
});
