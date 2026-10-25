import { describe, expect, it } from "vitest";
import {
  buildStandaloneReviewQueue,
} from "../../scripts/mine-attested-standalone-contexts.js";
import { gitBlobSha } from "../../scripts/verify-attested-ud-source.js";

function sentence(id:string,text:string,word:string,upos:string) {
  return [
    "# sent_id = " + id,
    "# text = " + text,
    "1\t" + word + "\t" + word + "\t" + upos + "\t_\t_\t0\troot\t_\tTranslit=untrusted",
    "",
    "",
  ].join("\n");
}
const sources={
  train:sentence("train-s1","種","種","NOUN")
    + sentence("train-s2","給","給","VERB"),
  dev:sentence("dev-s1","給（保留測試）","給","ADP"),
  test:sentence("test-s1","種（保留測試）","種","VERB"),
};
const pinned={
  train:gitBlobSha(sources.train),
  dev:gitBlobSha(sources.dev),
  test:gitBlobSha(sources.test),
};

describe("pinned train-only standalone context discovery",()=>{
  it("collects unlabeled train examples without borrowing dev/test sentences",()=>{
    const r=buildStandaloneReviewQueue(sources,pinned);
    expect(r.trainQueueSize).toBe(2);
    expect(r.groupCounts).toEqual({
      train:{"種/NOUN":1,"給/VERB":1},
      dev:{"給/ADP":1},
      test:{"種/VERB":1},
    });
    expect(r.trainReviewCandidates.map(x=>x.sentenceId)).toEqual(["train-s1","train-s2"]);
    expect(r.trainReviewCandidates.every(x=>x.reviewStatus==="unlabeled")).toBe(true);
    const exported=JSON.stringify(r.trainReviewCandidates);
    expect(exported).not.toContain("untrusted");
    expect(exported).not.toContain("保留測試");
    expect(exported).not.toContain("reviewedCharacterZhuyin");
    expect(exported).not.toContain("sourceTokenTranslit");
  });
  it("rejects a corpus that does not match its independent pinned blob",()=>{
    const changed={...sources,train:sources.train+"# modified\n"};
    expect(()=>buildStandaloneReviewQueue(changed,pinned)).toThrow(/train corpus blob mismatch/);
  });
  it("cannot derive a correct reading from token POS or UD translit",()=>{
    const r=buildStandaloneReviewQueue(sources,pinned);
    expect(r.trainReviewCandidates[0]).toMatchObject({
      word:"種",corpusUpos:"NOUN",reviewStatus:"unlabeled",
    });
    expect(r.trainReviewCandidates[1]).toMatchObject({
      word:"給",corpusUpos:"VERB",reviewStatus:"unlabeled",
    });
    expect(JSON.stringify(r.trainReviewCandidates)).not.toMatch(/ㄓㄨㄥ|ㄍㄟ|ㄐㄧ/);
  });
});
