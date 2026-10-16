import { describe, expect, it } from "vitest";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { extractAttestedClauseSpans } from "../../src/curriculum/attested-clause-spans.js";

function t(id: number, form: string, upos: string, head: number, relation: string): UdOccurrenceToken {
  return { id, form, upos, head, relation, feats: "_" };
}

describe("source-contiguous finite subordinate clause candidates", () => {
  const source = [
    t(1, "他", "PRON", 2, "nsubj"),
    t(2, "說", "VERB", 0, "root"),
    t(3, "我", "PRON", 4, "nsubj"),
    t(4, "吃", "VERB", 2, "ccomp"),
    t(5, "飯", "NOUN", 4, "obj"),
    t(6, "。", "PUNCT", 2, "punct"),
  ];
  it("recovers an exact subclause without borrowing matrix material", () => {
    expect(extractAttestedClauseSpans(source)).toEqual([{
      sourceHeadTokenId: 4,
      sourceRelation: "ccomp",
      tokens: source.slice(2, 5),
    }]);
  });

  it("rejects a subordinate predicate whose subject was never supplied", () => {
    const sourceWithoutSubject = source.filter(token => token.id !== 3);
    expect(extractAttestedClauseSpans(sourceWithoutSubject)).toEqual([]);
  });

  it("refuses noncontiguous subtree fragments", () => {
    const intervening = [
      source[0]!, source[1]!, source[2]!,
      t(7, "但是", "CCONJ", 2, "cc"),
      source[3]!, source[4]!, source[5]!,
    ];
    expect(extractAttestedClauseSpans(intervening)).toEqual([]);
  });

  it("ignores relative clauses, unanchored conj and unsupported inferred subjects", () => {
    const alternative = source.map(token => token.id === 4
      ? { ...token, relation: "acl" } : token);
    expect(extractAttestedClauseSpans(alternative)).toEqual([]);
    const coordination = source.map(token => token.id === 4
      ? { ...token, relation: "conj" } : token);
    expect(extractAttestedClauseSpans(coordination)).toEqual([]);
  });
});
