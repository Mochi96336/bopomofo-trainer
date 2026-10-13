import { describe, expect, it } from "vitest";
import { summarizeQuotedContentSourceEvidence } from "../../scripts/quoted-content-source-evidence.js";

const SOURCE = [
  "# sent_id = reporting-after",
  "1\t「\t_\tPUNCT\t_\t_\t3\tpunct\t_\t_",
  "2\t我\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "3\t來\t_\tVERB\t_\t_\t6\tparataxis\t_\t_",
  "4\t」\t_\tPUNCT\t_\t_\t3\tpunct\t_\t_",
  "5\t他\t_\tPRON\t_\t_\t6\tnsubj\t_\t_",
  "6\t說\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = reporting-before-ccomp",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t說\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t「\t_\tPUNCT\t_\t_\t5\tpunct\t_\t_",
  "4\t你\t_\tPRON\t_\t_\t5\tnsubj\t_\t_",
  "5\t走\t_\tVERB\t_\t_\t2\tccomp\t_\t_",
  "6\t」\t_\tPUNCT\t_\t_\t5\tpunct\t_\t_",
  "",
  "# sent_id = standalone-quote",
  "1\t「\t_\tPUNCT\t_\t_\t3\tpunct\t_\t_",
  "2\t別\t_\tADV\t_\t_\t3\tadvmod\t_\t_",
  "3\t走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "4\t」\t_\tPUNCT\t_\t_\t3\tpunct\t_\t_",
  "",
].join("\n");

describe("quoted-content source evidence", () => {
  it("finds exact corner-quote spans and their single boundary roots", () => {
    const evidence = summarizeQuotedContentSourceEvidence([SOURCE]);
    expect(evidence.cornerQuoteSpanCount).toBe(3);
    expect(evidence.spanWithSingleBoundaryRootCount).toBe(3);
    expect(evidence.spanWithNoBoundaryRootCount).toBe(0);
    expect(evidence.spanWithMultipleBoundaryRootsCount).toBe(0);
  });

  it("separates parataxis, ccomp, and standalone quoted roots", () => {
    const evidence = summarizeQuotedContentSourceEvidence([SOURCE]);
    expect(evidence.quotedRootRelationCounts).toEqual({
      ccomp: 1,
      parataxis: 1,
      root: 1,
    });
    expect(evidence.externallyAttachedQuotedRootCount).toBe(2);
    expect(evidence.standaloneQuotedRootCount).toBe(1);
  });

  it("measures quote position and matrix subject realization independently", () => {
    const evidence = summarizeQuotedContentSourceEvidence([SOURCE]);
    expect(evidence.quoteBeforeGovernorCount).toBe(1);
    expect(evidence.quoteAfterGovernorCount).toBe(1);
    expect(evidence.governorWithSubjectCount).toBe(2);
    expect(evidence.quotedRootWithSubjectCount).toBe(2);
    expect(evidence.quotedRootWithoutSubjectCount).toBe(1);
    expect(evidence.clauseLikeQuotedRootCount).toBe(3);
    expect(evidence.clauseLikeExternallyAttachedCount).toBe(2);
    expect(evidence.clauseLikeRelationCounts).toEqual({
      ccomp: 1,
      parataxis: 1,
      root: 1,
    });
  });
});
