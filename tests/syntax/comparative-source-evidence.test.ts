import { describe, expect, it } from "vitest";
import { summarizeComparativeSourceEvidence } from "../../scripts/comparative-source-evidence.js";

const SOURCE = [
  "# sent_id = adjective-comparative",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t比\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t我\t_\tPRON\t_\t_\t4\tnmod\t_\t_",
  "4\t高\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = verbal-comparative",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t比\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t我\t_\tPRON\t_\t_\t4\tobl\t_\t_",
  "4\t靠近\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = non-case-bi",
  "1\t比\t_\tCCONJ\t_\t_\t2\tcc\t_\t_",
  "2\t較\t_\tADV\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("comparative source evidence", () => {
  it("separates exact 比/ADP(case) from homographic non-comparative uses", () => {
    const evidence = summarizeComparativeSourceEvidence([SOURCE]);

    expect(evidence.biTokenCount).toBe(3);
    expect(evidence.biUposRelationCounts).toEqual({
      "ADP\u0000case": 2,
      "CCONJ\u0000cc": 1,
    });
    expect(evidence.exactCaseAdpTokenCount).toBe(2);
  });

  it("preserves standard relation and adjective-versus-verb predicate evidence", () => {
    const evidence = summarizeComparativeSourceEvidence([SOURCE]);

    expect(evidence.standardHeadUposCounts).toEqual({ PRON: 2 });
    expect(evidence.standardRelationCounts).toEqual({ nmod: 1, obl: 1 });
    expect(evidence.nominalStandardTokenCount).toBe(2);

    expect(evidence.governingPredicateTokenCount).toBe(2);
    expect(evidence.governingPredicateUposCounts).toEqual({ ADJ: 1, VERB: 1 });
    expect([...evidence.comparativePredicateCounts].sort()).toEqual([
      ["靠近\u0000VERB", 1],
      ["高\u0000ADJ", 1],
    ]);
    expect(evidence.adjectivalPredicateTokenCount).toBe(1);
    expect(evidence.verbalPredicateTokenCount).toBe(1);
  });

  it("measures the source order and overt-subject boundary without making them grammar heuristics", () => {
    const evidence = summarizeComparativeSourceEvidence([SOURCE]);

    expect(evidence.markerBeforeStandardTokenCount).toBe(2);
    expect(evidence.standardBeforePredicateTokenCount).toBe(2);
    expect(evidence.predicateWithSubjectTokenCount).toBe(2);
    expect(evidence.predicateWithoutSubjectTokenCount).toBe(0);
    expect(evidence.predicateRootTokenCount).toBe(2);
    expect(evidence.predicateNonRootTokenCount).toBe(0);
  });
});
