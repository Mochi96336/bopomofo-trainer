import { describe, expect, it } from "vitest";
import {
  summarizeDirectQuoteAttachmentEvidence,
} from "../../scripts/direct-quote-attachment-evidence.js";
import type { QuotedContentOccurrence } from "../../scripts/quoted-content-source-evidence.js";

function occurrence(
  relation: "ccomp" | "xcomp" | "parataxis" | "obj",
  governorForm: string,
  governorUpos = "VERB",
  overrides: Partial<QuotedContentOccurrence> = {},
): QuotedContentOccurrence {
  return {
    sourceIndex: 0,
    sentenceIndex: 0,
    sentence: `${governorForm}「你走」`,
    openId: 2,
    closeId: 5,
    boundaryRootCount: 1,
    quotedRootId: 4,
    quotedRootForm: "走",
    quotedRootUpos: "VERB",
    quotedRootRelation: relation,
    quotedRootSubjectCount: 1,
    quotedRootHasCopula: false,
    quotedRootClauseLike: true,
    governorId: 1,
    governorForm,
    governorUpos,
    governorRelation: "root",
    governorIsRoot: true,
    governorSubjectCount: 1,
    governorHasObject: false,
    governorHasOtherCcomp: false,
    governorHasXcomp: false,
    governorHasOtherParataxis: false,
    quoteBeforeGovernor: false,
    ...overrides,
  };
}

describe("direct-quote attachment evidence", () => {
  it("keeps attachment relations separate", () => {
    const evidence = summarizeDirectQuoteAttachmentEvidence([
      occurrence("ccomp", "說"),
      occurrence("parataxis", "表示"),
      occurrence("xcomp", "要求"),
      occurrence("obj", "喊"),
    ]);
    expect(evidence.relationCounts).toEqual({
      ccomp: 1,
      obj: 1,
      parataxis: 1,
      xcomp: 1,
    });
  });

  it("detects the same governor identity across different attachment relations", () => {
    const evidence = summarizeDirectQuoteAttachmentEvidence([
      occurrence("ccomp", "說"),
      occurrence("parataxis", "說"),
      occurrence("ccomp", "表示"),
    ]);
    expect(evidence.crossRelationGovernorIdentityCount).toBe(1);
    expect(evidence.crossRelationGovernorIdentities).toEqual([
      {
        identity: "說\u0000VERB",
        form: "說",
        upos: "VERB",
        relations: ["ccomp", "parataxis"],
        occurrenceCount: 2,
      },
    ]);
    expect(evidence.relationPairSharedGovernorIdentityCounts["ccomp|parataxis"]).toBe(1);
  });

  it("drops quote spans outside the reviewed structural candidate boundary", () => {
    const evidence = summarizeDirectQuoteAttachmentEvidence([
      occurrence("ccomp", "說", "VERB", { quotedRootClauseLike: false }),
      occurrence("nmod" as "ccomp", "名稱", "NOUN", {
        quotedRootRelation: "nmod",
        quotedRootClauseLike: true,
      }),
    ]);
    expect(evidence.candidateCount).toBe(0);
  });
});
