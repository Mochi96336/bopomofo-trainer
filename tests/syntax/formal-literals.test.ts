import { describe, expect, it } from "vitest";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { COMPLEMENT_PRODUCTION_RULES } from "../../src/syntax/grammar.js";
import { realizeStructuralDerivation } from "../../src/syntax/realize.js";
import type { StructuralDerivationShape, StructuralLexicalSlot } from "../../src/syntax/derive.js";

function literalSlot(id: string, key: string, formalLiteral: string): StructuralLexicalSlot {
  return {
    kind: "lexical-slot",
    id,
    constituentKey: key,
    occurrenceIndex: 0,
    allowedUpos: ["PUNCT"],
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {},
    formalLiteral,
  };
}

describe("formal literal terminals", () => {
  it("declares distinct required opening and closing quote literals", () => {
    const rule = COMPLEMENT_PRODUCTION_RULES.find((item) => item.id === "quoted.clause");
    expect(rule).toBeDefined();
    expect(rule?.constituents.map((item) => [item.key, item.formalLiteral ?? null])).toEqual([
      ["openPunctuation", "「"],
      ["clause", null],
      ["closePunctuation", "」"],
    ]);
    expect(rule?.constituents[0]?.minimum).toBe(1);
    expect(rule?.constituents[2]?.minimum).toBe(1);
  });

  it("realizes each formal literal instead of reusing the sentence punctuation token", () => {
    const open = literalSlot("slot:open", "openPunctuation", "「");
    const close = literalSlot("slot:close", "closePunctuation", "」");
    const shape: StructuralDerivationShape = {
      id: "shape:quoted",
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      root: {
        kind: "syntax-node",
        id: "node:quoted",
        category: "QuotedClause",
        productionRuleId: "quoted.clause",
        surfaceOrderId: "canonical",
        children: [open, close],
      },
      productionRulePath: ["quoted.clause"],
      lexicalSlots: [open, close],
      clauseCount: 0,
      lexicalSlotCount: 2,
    };

    const realization = realizeStructuralDerivation(shape, {
      entries: [],
      profiles: [],
      punctuationToken: "。",
    });
    expect(realization?.tokens.map((token) => token.value)).toEqual(["「", "」"]);
    expect(realization?.entryIds).toEqual([]);
  });
});
