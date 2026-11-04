import { describe, expect, it } from "vitest";
import type { PolyphonicContextHit } from "../../src/readings/polyphonic-audit.js";
import type { SyntacticFunction, Upos } from "../../src/syntax/types.js";
import { buildSameUposReviewQueue } from "../../src/readings/same-upos-review.js";
import { auditSameUposSenseReadiness } from "../../src/readings/same-upos-sense-readiness.js";

function hit(
  text: string, reading: string, upos: Upos, seedIndex: number,
  functions: readonly SyntacticFunction[],
): PolyphonicContextHit {
  return {
    seedIndex,
    sentence: text + "示例",
    punctuation: null,
    syntaxRootRuleId: "sentence.example",
    entryIndex: 1,
    text,
    selectedEntryId: "word:" + text + ":" + reading,
    selectedProfileId: "profile:" + reading,
    selectedUpos: upos,
    selectedFunctions: functions,
    alternativeEntryIds: [],
    previousEntryText: "示例",
    nextEntryText: "測試",
  };
}

describe("MOE-attested same-UPOS sound evidence readiness", () => {
  const hits = [
    hit("那","ㄋㄚ3","PRON",1,["determiner","subject"]),
    hit("那","ㄋㄚ4","PRON",2,["subject","determiner"]),
    hit("那","ㄋㄨㄛ2","PRON",3,["determiner","subject"]),
    hit("給","ㄍㄟ3","VERB",4,["predicate"]),
    hit("給","ㄐㄧ3","VERB",5,["predicate"]),
    hit("供","ㄍㄨㄥ1","VERB",6,["predicate"]),
    hit("供","ㄍㄨㄥ4","VERB",7,["predicate"]),
  ];
  it("observes identical aggregate function sets without claiming sense-level correctness", () => {
    const queue = buildSameUposReviewQueue(hits);
    const result = auditSameUposSenseReadiness(queue, hits);
    expect(result.moeAttestedGroups).toBe(3);
    expect(result.moeAttestedOccurrences).toBe(7);
    expect(result.groupsWithIdenticalProfileFunctions).toBe(3);
    expect(result.unchangedUnreviewedGroups).toBe(queue.unreviewedGroups);
    expect(result.unchangedUnreviewedOccurrences).toBe(queue.unreviewedOccurrences);
    expect(result.groups.every(g => g.perInstanceSenseEvidence === "not-collected")).toBe(true);
    expect(result.groups.find(g => g.text==="那")?.readingEvidence.map(r => r.occurrences)).toEqual([1,1,1]);
    expect(result.groups.every(g=>g.sourceUrl.includes("dict.revised.moe.edu.tw"))).toBe(true);
  });
  it("different profile function sets are not evidence of an actual sentence sense", () => {
    const altered = hits.map(h =>
      h.text === "給" && h.selectedEntryId.endsWith("ㄐㄧ3")
        ? { ...h, selectedFunctions: ["complement"] as SyntacticFunction[] } : h,
    );
    const result = auditSameUposSenseReadiness(buildSameUposReviewQueue(altered),altered);
    expect(result.groups.find(g=>g.text==="給")?.profileFunctionsAllReadingsIdentical).toBe(false);
    expect(result.groups.find(g=>g.text==="給")?.distinctProfileFunctionSets).toBe(2);
    expect(result.groups.find(g=>g.text==="給")?.perInstanceSenseEvidence).toBe("not-collected");
  });
  it("fails closed if compared hits drift from the source same-UPOS queue", () => {
    const queue=buildSameUposReviewQueue(hits);
    expect(()=>auditSameUposSenseReadiness(queue,hits.slice(1))).toThrow(/evidence drift/);
    const missing = hits.map((h,i)=>i===0?{...h,selectedProfileId:null}:h);
    expect(()=>auditSameUposSenseReadiness(queue,missing)).toThrow(/profile-joined/);
  });
  it("does not certify an unseen new pronunciation", () => {
    const altered=[...hits,hit("給","ㄍㄟ4","VERB",8,["predicate"])];
    const q=buildSameUposReviewQueue(altered);
    const res=auditSameUposSenseReadiness(q,altered);
    expect(res.groups.some(g=>g.text==="給")).toBe(false);
    expect(res.moeAttestedGroups).toBe(2);
    expect(res.unchangedUnreviewedGroups).toBe(q.unreviewedGroups);
    expect(res.unchangedUnreviewedOccurrences).toBe(q.unreviewedOccurrences);
  });
});
