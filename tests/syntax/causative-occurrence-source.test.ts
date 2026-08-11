import { describe, expect, it } from "vitest";
import {
  lexemeUposKey,
  parseCausativeOccurrenceEvidence,
} from "../../scripts/causative-occurrence-source.js";

const SAME_OCCURRENCE = [
  "# sent_id = same",
  "1\t讓\t_\tVERB\t_\tVoice=Cau\t0\troot\t_\t_",
  "2\t他\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "3\t走\t_\tVERB\t_\t_\t1\tccomp\t_\t_",
  "",
].join("\n");

const SPLIT_OCCURRENCES = [
  "# sent_id = morphology-only",
  "1\t阻止\t_\tVERB\t_\tVoice=Cau\t0\troot\t_\t_",
  "2\t事件\t_\tNOUN\t_\t_\t1\tobj\t_\t_",
  "",
  "# sent_id = ccomp-only",
  "1\t阻止\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "2\t他\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "3\t離開\t_\tVERB\t_\t_\t1\tccomp\t_\t_",
  "",
].join("\n");

describe("causative same-occurrence evidence", () => {
  it("records Voice=Cau plus a direct ccomp on the same matrix token", () => {
    const evidence = parseCausativeOccurrenceEvidence(SAME_OCCURRENCE);
    const key = lexemeUposKey("讓", "VERB");

    expect(evidence.voiceCauTokenCount).toBe(1);
    expect(evidence.sameTokenCcompTokenCount).toBe(1);
    expect(evidence.sameTokenCcompOwnSubjectTokenCount).toBe(1);
    expect(evidence.sameTokenCcompCounts.get(key)).toBe(1);
  });

  it("does not join Voice=Cau and ccomp across separate occurrences", () => {
    const evidence = parseCausativeOccurrenceEvidence(SPLIT_OCCURRENCES);
    const key = lexemeUposKey("阻止", "VERB");

    expect(evidence.voiceCauCounts.get(key)).toBe(1);
    expect(evidence.sameTokenCcompCounts.has(key)).toBe(false);
  });
});
