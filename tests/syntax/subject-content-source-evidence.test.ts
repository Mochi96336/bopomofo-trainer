import { describe, expect, it } from "vitest";
import {
  summarizeSubjectContentSourceEvidence,
} from "../../scripts/subject-content-source-evidence.js";

const SOURCE = [
  "# sent_id = preposed-subject-clause",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t來\t_\tVERB\t_\t_\t4\tcsubj\t_\t_",
  "3\t很\t_\tADV\t_\t_\t4\tadvmod\t_\t_",
  "4\t重要\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = postposed-passive-subject-clause",
  "1\t知道\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "2\t結果\t_\tNOUN\t_\t_\t3\tnsubj\t_\t_",
  "3\t公布\t_\tVERB\t_\t_\t1\tcsubj:pass\t_\t_",
  "4\t大家\t_\tPRON\t_\t_\t1\tnsubj\t_\t_",
  "",
  "# sent_id = nominal-subject-control",
  "1\t事情\t_\tNOUN\t_\t_\t2\tnsubj\t_\t_",
  "2\t發生\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("subject-content source evidence", () => {
  it("isolates csubj and csubj subtypes from ordinary nominal subjects", () => {
    const evidence = summarizeSubjectContentSourceEvidence([SOURCE]);

    expect(evidence.clausalSubjectTokenCount).toBe(2);
    expect(evidence.clausalSubjectRelationCounts).toEqual({
      csubj: 1,
      "csubj:pass": 1,
    });
    expect(evidence.subjectClauseHeadUposCounts).toEqual({ VERB: 2 });
  });

  it("measures matrix predicate shape without converting it into lexical grammar yet", () => {
    const evidence = summarizeSubjectContentSourceEvidence([SOURCE]);

    expect(evidence.governingPredicateTokenCount).toBe(2);
    expect(evidence.governingPredicateUposCounts).toEqual({ ADJ: 1, VERB: 1 });
    expect([...evidence.governingPredicateCounts].sort()).toEqual([
      ["知道\u0000VERB", 1],
      ["重要\u0000ADJ", 1],
    ]);
    expect(evidence.predicateRootTokenCount).toBe(2);
    expect(evidence.predicateNonRootTokenCount).toBe(0);
  });

  it("keeps subject-clause realization and matrix-subject coexistence as separate observations", () => {
    const evidence = summarizeSubjectContentSourceEvidence([SOURCE]);

    expect(evidence.subjectClauseBeforePredicateTokenCount).toBe(1);
    expect(evidence.subjectClauseAfterPredicateTokenCount).toBe(1);
    expect(evidence.subjectClauseWithOvertSubjectTokenCount).toBe(2);
    expect(evidence.subjectClauseWithoutOvertSubjectTokenCount).toBe(0);
    expect(evidence.predicateWithAdditionalSubjectTokenCount).toBe(1);
    expect(evidence.predicateWithoutAdditionalSubjectTokenCount).toBe(1);
  });
});
