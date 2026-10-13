import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { lexicalConstructionFeatureMatches } from "../../src/syntax/lexical-feature-match.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function rule(id: string) {
  const found = FORMAL_SYNTAX_RULES.find((item) => item.id === id);
  if (found === undefined) throw new Error(`missing test rule ${id}`);
  return found;
}

function markerProfile(upos: RuntimeSyntaxProfile["upos"], relation: string): RuntimeSyntaxProfile {
  return {
    id: `profile:${upos}:${relation}`,
    entryId: "test",
    upos,
    functions: upos === "ADP" ? ["adposition"] : ["coordinator"],
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: { [relation]: 1 },
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

describe("有關 relational ccomp construction", () => {
  it("keeps the reviewed structure narrow and capability-gated", () => {
    const relational = rule("clause.relational-adjective-content");
    expect(relational.constituents).toHaveLength(4);
    expect(relational.constituents[0]).toMatchObject({
      key: "subject",
      category: "Subject",
      minimum: 0,
      maximum: 1,
    });
    expect(relational.constituents[1]).toMatchObject({
      key: "marker",
      category: "Lexeme",
      allowedUpos: ["ADP"],
      requiredFeatures: { clauseType: "relational-ccomp" },
    });
    expect(relational.constituents[2]).toMatchObject({
      key: "contentClause",
      category: "ContentClause",
      recursive: true,
    });
    expect(relational.constituents[3]).toMatchObject({
      key: "predicate",
      category: "Lexeme",
      allowedUpos: ["ADJ"],
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["clausal-complement"],
      requiredOccurrenceCapabilities: [
        "relational-adjective-youguan-case-ccomp-same-occurrence",
      ],
    });
  });

  it("licenses only the reviewed 與/和 construction readings as ADP case markers", () => {
    const adpCase = markerProfile("ADP", "case");
    expect(lexicalConstructionFeatureMatches(
      catalogEntryId("與", "ㄩ3"),
      "與",
      adpCase,
      "clauseType",
      "relational-ccomp",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      catalogEntryId("和", "ㄏㄜ2"),
      "和",
      adpCase,
      "clauseType",
      "relational-ccomp",
    )).toBe(true);

    expect(lexicalConstructionFeatureMatches(
      catalogEntryId("與", "ㄩ4"),
      "與",
      adpCase,
      "clauseType",
      "relational-ccomp",
    )).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      catalogEntryId("和", "ㄏㄨㄛ4"),
      "和",
      adpCase,
      "clauseType",
      "relational-ccomp",
    )).toBe(false);
  });

  it("rejects coordination profiles and unrelated ADP forms", () => {
    expect(lexicalConstructionFeatureMatches(
      catalogEntryId("和", "ㄏㄜ2"),
      "和",
      markerProfile("CCONJ", "cc"),
      "clauseType",
      "relational-ccomp",
    )).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      "word:因為:ㄧㄣ1-ㄨㄟ4",
      "因為",
      markerProfile("ADP", "case"),
      "clauseType",
      "relational-ccomp",
    )).toBe(false);
  });
});
