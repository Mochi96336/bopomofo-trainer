import { describe, expect, it } from "vitest";
import { lexemeUposKey } from "../../scripts/ud-occurrence-source.js";
import { parsePassiveOccurrenceEvidence } from "../../scripts/passive-occurrence-source.js";

const SHORT_WITH_SUBJECT = [
  "# sent_id = short-passive",
  "1\t書\t_\tNOUN\t_\t_\t3\tnsubj:pass\t_\t_",
  "2\t被\t_\tAUX\t_\t_\t3\taux:pass\t_\t_",
  "3\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const SHORT_WITHOUT_SUBJECT = [
  "# sent_id = short-no-subject",
  "1\t被\t_\tAUX\t_\t_\t2\taux:pass\t_\t_",
  "2\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const LONG_WITH_SUBJECT = [
  "# sent_id = long-passive",
  "1\t書\t_\tNOUN\t_\t_\t5\tnsubj:pass\t_\t_",
  "2\t被\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t他\t_\tPRON\t_\t_\t5\tobl:agent\t_\t_",
  "4\t已經\t_\tADV\t_\t_\t5\tadvmod\t_\t_",
  "5\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const LONG_WITHOUT_SUBJECT = [
  "# sent_id = long-no-subject",
  "1\t被\t_\tADP\t_\t_\t2\tcase\t_\t_",
  "2\t他\t_\tPRON\t_\t_\t3\tobl:agent\t_\t_",
  "3\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const SPLIT_LONG_FACTS = [
  "# sent_id = agent-no-marker",
  "1\t他\t_\tPRON\t_\t_\t2\tobl:agent\t_\t_",
  "2\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = unrelated-bei",
  "1\t被\t_\tADP\t_\t_\t2\tcase\t_\t_",
  "2\t事情\t_\tNOUN\t_\t_\t3\tobl\t_\t_",
  "3\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const SPLIT_SHORT_FACTS = [
  "# sent_id = passive-subject-only",
  "1\t事情\t_\tNOUN\t_\t_\t2\tnsubj:pass\t_\t_",
  "2\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = unrelated-aux-pass",
  "1\t被\t_\tAUX\t_\t_\t2\taux\t_\t_",
  "2\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("passive same-occurrence evidence", () => {
  it("recognizes short passive from direct AUX 被 / aux:pass", () => {
    const evidence = parsePassiveOccurrenceEvidence(SHORT_WITH_SUBJECT);
    const key = lexemeUposKey("拿走", "VERB");
    expect(evidence.shortPassivePredicateTokenCount).toBe(1);
    expect(evidence.shortPassivePredicateCounts.get(key)).toBe(1);
    expect(evidence.shortPassiveWithSubjectTokenCount).toBe(1);
    expect(evidence.longPassivePredicateTokenCount).toBe(0);
    expect(evidence.passivePredicateTokenCount).toBe(1);
  });

  it("does not require an overt passive subject for short-passive evidence", () => {
    const evidence = parsePassiveOccurrenceEvidence(SHORT_WITHOUT_SUBJECT);
    expect(evidence.shortPassivePredicateTokenCount).toBe(1);
    expect(evidence.shortPassiveWithSubjectTokenCount).toBe(0);
  });

  it("recognizes long passive only when obl:agent owns ADP 被 / case", () => {
    const evidence = parsePassiveOccurrenceEvidence(LONG_WITH_SUBJECT);
    const key = lexemeUposKey("拿走", "VERB");
    expect(evidence.longPassivePredicateTokenCount).toBe(1);
    expect(evidence.longPassivePredicateCounts.get(key)).toBe(1);
    expect(evidence.longPassiveWithSubjectTokenCount).toBe(1);
    expect(evidence.shortPassivePredicateTokenCount).toBe(0);
    expect(evidence.passivePredicateTokenCount).toBe(1);
  });

  it("does not require an overt passive subject for long-passive evidence", () => {
    const evidence = parsePassiveOccurrenceEvidence(LONG_WITHOUT_SUBJECT);
    expect(evidence.longPassivePredicateTokenCount).toBe(1);
    expect(evidence.longPassiveWithSubjectTokenCount).toBe(0);
  });

  it("does not join obl:agent and unrelated 被 across occurrences", () => {
    const evidence = parsePassiveOccurrenceEvidence(SPLIT_LONG_FACTS);
    expect(evidence.longPassivePredicateTokenCount).toBe(0);
    expect(evidence.passivePredicateTokenCount).toBe(0);
  });

  it("does not treat nsubj:pass plus non-aux:pass 被 as short-passive proof", () => {
    const evidence = parsePassiveOccurrenceEvidence(SPLIT_SHORT_FACTS);
    expect(evidence.shortPassivePredicateTokenCount).toBe(0);
    expect(evidence.passivePredicateTokenCount).toBe(0);
  });
});
