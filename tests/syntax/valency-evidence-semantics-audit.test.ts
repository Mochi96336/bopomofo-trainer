import { describe, expect, it } from "vitest";
import type { SyntaxEvidenceArtifact } from "../../src/syntax/profile-projection.js";
import { auditValencyEvidenceSemantics } from "../../src/syntax/valency-evidence-semantics-audit.js";

function artifact(): SyntaxEvidenceArtifact {
  return {
    schemaVersion: "ud-syntax-evidence-v2",
    source: { sourceId: "ud:test" },
    rows: [
      {
        text: "吃",
        observed: true,
        occurrenceCount: 5,
        uposCounts: { VERB: 5 },
        syntaxProfileEvidence: [{
          upos: "VERB",
          occurrenceCount: 5,
          valencySignatureCounts: { none: 2, "obj=1": 3 },
        }],
      },
      {
        text: "希望",
        observed: true,
        occurrenceCount: 4,
        uposCounts: { VERB: 4 },
        syntaxProfileEvidence: [{
          upos: "VERB",
          occurrenceCount: 4,
          valencySignatureCounts: { "ccomp=1": 4 },
        }],
      },
      {
        text: "住",
        observed: true,
        occurrenceCount: 3,
        uposCounts: { VERB: 3 },
        syntaxProfileEvidence: [{
          upos: "VERB",
          occurrenceCount: 3,
          valencySignatureCounts: { "obl=1": 3 },
        }],
      },
      {
        text: "書",
        observed: true,
        occurrenceCount: 2,
        uposCounts: { NOUN: 2 },
        syntaxProfileEvidence: [{
          upos: "NOUN",
          occurrenceCount: 2,
          valencySignatureCounts: { none: 2 },
        }],
      },
    ],
  };
}

describe("valency evidence semantics audit", () => {
  it("separates surface object realization from current lexical-looking frame projection", () => {
    const result = auditValencyEvidenceSemantics(artifact());

    expect(result.predicateProfileCount).toBe(3);
    expect(result.mixedNominalObjectRealizationProfileCount).toBe(1);
    expect(result.complementlessOccurrenceFeedsIntransitiveProfileCount).toBe(1);
    expect(result.mixedOccurrenceFeedsAmbitransitiveProfileCount).toBe(1);
    expect(result.genericObliqueFeedsAdpositionalComplementProfileCount).toBe(1);

    expect(result.findings.find((item) => item.text === "吃")).toMatchObject({
      mixedNominalObjectRealization: true,
      complementlessOccurrenceFeedsIntransitive: true,
      mixedOccurrenceFeedsAmbitransitive: true,
      genericObliqueFeedsAdpositionalComplement: false,
    });
  });

  it("does not mistake a positive ccomp occurrence for complementless evidence", () => {
    const result = auditValencyEvidenceSemantics(artifact());
    expect(result.findings.some((item) => item.text === "希望")).toBe(false);
  });

  it("flags base obl as insufficiently specific for lexical adpositional-complement claims", () => {
    const result = auditValencyEvidenceSemantics(artifact());
    expect(result.findings.find((item) => item.text === "住")).toMatchObject({
      mixedNominalObjectRealization: false,
      complementlessOccurrenceFeedsIntransitive: false,
      mixedOccurrenceFeedsAmbitransitive: false,
      genericObliqueFeedsAdpositionalComplement: true,
    });
  });
});
