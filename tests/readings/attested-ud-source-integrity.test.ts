import { describe, expect, it } from "vitest";
import type { ContextBank } from "../../scripts/prototype-attested-reading-selector.js";
import {
  gitBlobSha, verifyAttestedSourceEvidence, type SourceEvidenceBank,
} from "../../scripts/verify-attested-ud-source.js";

const ud = [
  "# sent_id = dev-fixture",
  "# text = 兩種給工資給叔父",
  "1\t兩\t兩\tNUM\t_\t_\t2\tnummod\t_\tSpaceAfter=No|Translit=liǎng",
  "2\t種\t種\tNOUN\t_\t_\t0\troot\t_\tSpaceAfter=No|Translit=zhǒng",
  "3\t給\t給\tVERB\t_\t_\t2\tconj\t_\tSpaceAfter=No|Translit=gěi",
  "4\t工資\t工資\tNOUN\t_\t_\t3\tobj\t_\tSpaceAfter=No|Translit=gōngzī",
  "5\t給\t給\tVERB\t_\t_\t2\tconj\t_\tSpaceAfter=No|Translit=gěi",
  "6\t叔父\t叔父\tNOUN\t_\t_\t5\tobj\t_\tTranslit=shūfù",
  "",
  "",
].join("\n");
const corpusBlobSha = gitBlobSha(ud);
const identity = [
  {id:"gsd-012",token:2,word:"種",upos:"NOUN",offset:1,translit:"zhǒng"},
  {id:"gsd-013",token:3,word:"給",upos:"VERB",offset:2,translit:"gěi"},
  {id:"gsd-015",token:5,word:"給",upos:"VERB",offset:5,translit:"gěi"},
] as const;
const bank = {
  source:{path:"zh_gsd-ud-dev.conllu",blobSha:corpusBlobSha},
  cases:identity.map(x=>({
    id:x.id,sourceSentId:"dev-fixture",sourceText:"兩種給工資給叔父",
    sourceFile:"zh_gsd-ud-dev.conllu",sourceTokenId:x.token,
    sourceTokenText:x.word,sourceTokenUpos:x.upos,sourceTokenStart:x.offset,
    sourceTokenTranslit:x.translit,targetCharacter:x.word,
    characterOffsetInToken:0,reviewedCharacterZhuyin:"ㄍㄟˇ",
  })),
} as unknown as ContextBank;
const evidence:SourceEvidenceBank={
  cases:identity.map(x=>({
    caseId:x.id,sourceSentId:"dev-fixture",sourceTokenId:x.token,
    sourceWord:x.word,sourceUpos:x.upos,sourceCorpusBlobSha:corpusBlobSha,
    rawUdEvidenceTokens:[{
      tokenId:x.token,text:x.word,upos:x.upos,
      headTokenId:x.token===2?0:2,deprel:x.token===2?"root":"conj",
    }],
  })),
};

describe("independent original UD-source integrity gate",()=>{
  it("checks Git blob content, 18-row-style token fields and dependency edges",()=>{
    const result=verifyAttestedSourceEvidence(ud,bank,evidence);
    expect(result).toEqual({
      corpusBlobSha,corpusSentences:1,attestedTargetsVerified:3,rawContextCuesVerified:3,
    });
  });
  it("fails if the original source drifts, even when the local evidence agrees",()=>{
    expect(()=>verifyAttestedSourceEvidence(ud.replace("nummod","dep"),bank,evidence))
      .toThrow(/Git blob mismatch/);
  });
  it("rejects a copied dependency edge that disagrees with the original CoNLL-U",()=>{
    const changed=structuredClone(evidence) as {
      cases:{rawUdEvidenceTokens:{deprel:string;headTokenId:number}[]}[];
    };
    changed.cases[0]!.rawUdEvidenceTokens[0]!.deprel="dep";
    expect(()=>verifyAttestedSourceEvidence(ud,bank,changed))
      .toThrow(/source dependency mismatch/);
    changed.cases[0]!.rawUdEvidenceTokens[0]!.deprel="root";
    changed.cases[0]!.rawUdEvidenceTokens[0]!.headTokenId=3;
    expect(()=>verifyAttestedSourceEvidence(ud,bank,changed))
      .toThrow(/source dependency mismatch/);
  });
  it("source provenance check never uses the manually supplied correct reading",()=>{
    const changed=structuredClone(bank) as ContextBank;
    (changed.cases[0] as {reviewedCharacterZhuyin:string})
      .reviewedCharacterZhuyin="intentionally-wrong-gold";
    expect(verifyAttestedSourceEvidence(ud,changed,evidence))
      .toEqual(verifyAttestedSourceEvidence(ud,bank,evidence));
  });
});
