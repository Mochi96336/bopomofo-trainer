import { describe, expect, it } from "vitest";
import {
  summarizeConstituentSubjectQuestionSourceEvidence,
} from "../../scripts/constituent-subject-question-source-evidence.js";

const SOURCE = [
  "# sent_id = verbal-subject-question",
  "1\t誰\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t來\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = adjectival-subject-question",
  "1\t誰\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t高\t_\tADJ\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = copular-subject-question",
  "1\t誰\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "2\t是\t_\tAUX\t_\t_\t3\tcop\t_\t_",
  "3\t老師\t_\tNOUN\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = wh-inside-np-not-direct-subject",
  "1\t哪\t_\tDET\t_\t_\t2\tdet\t_\t_",
  "2\t個\t_\tNOUN\t_\t_\t3\tnsubj\t_\t_",
  "3\t來\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = object-question",
  "1\t你\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t看\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t什麼\t_\tPRON\t_\t_\t2\tobj\t_\t_",
  "",
].join("\n");

describe("constituent-subject-question source evidence", () => {
  it("separates all licensed interrogative tokens from direct subject occurrences", () => {
    const evidence = summarizeConstituentSubjectQuestionSourceEvidence([SOURCE]);
    expect(evidence.interrogativeTokenCount).toBe(5);
    expect(evidence.directSubjectTokenCount).toBe(3);
    expect(evidence.interrogativeRelationCounts).toEqual({
      det: 1,
      nsubj: 3,
      obj: 1,
    });
    expect(evidence.directSubjectFormCounts).toEqual({ 誰: 3 });
  });

  it("does not assume a direct interrogative subject has a verbal matrix head", () => {
    const evidence = summarizeConstituentSubjectQuestionSourceEvidence([SOURCE]);
    expect(evidence.governingHeadUposCounts).toEqual({
      ADJ: 1,
      NOUN: 1,
      VERB: 1,
    });
    expect(evidence.governingHeadWithCopulaTokenCount).toBe(1);
    expect(evidence.subjectBeforeHeadTokenCount).toBe(3);
    expect(evidence.subjectAfterHeadTokenCount).toBe(0);
  });

  it("keeps matrix argument shape as source observations instead of lexical licensing", () => {
    const evidence = summarizeConstituentSubjectQuestionSourceEvidence([SOURCE]);
    expect(evidence.governingHeadWithAdditionalSubjectTokenCount).toBe(0);
    expect(evidence.governingHeadWithObjectTokenCount).toBe(0);
    expect(evidence.governingHeadRootTokenCount).toBe(3);
    expect(evidence.governingHeadNonRootTokenCount).toBe(0);
  });
});
