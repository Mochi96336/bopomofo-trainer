import { describe, expect, it } from "vitest";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

function rule(id: string) {
  const found = FORMAL_SYNTAX_RULES.find((item) => item.id === id);
  if (found === undefined) throw new Error(`missing test rule ${id}`);
  return found;
}

describe("Clause-model v2 ccomp ownership", () => {
  it("routes matrix subject realization through the shared Subject wrapper", () => {
    expect(rule("clause.object-content").constituents.find((item) => item.key === "subject"))
      .toMatchObject({
        category: "Subject",
        minimum: 0,
        maximum: 1,
      });
  });

  it("keeps ccomp as recursive ContentClause without an object-function gate", () => {
    expect(rule("clause.object-content").constituents.find((item) => item.key === "objectClause"))
      .toMatchObject({
        category: "ContentClause",
        recursive: true,
        requiredFunctions: [],
      });
  });

  it("retains the legacy structural-target key without treating it as role semantics", () => {
    const ccomp = rule("clause.object-content");
    const embedded = ccomp.constituents.find((item) => item.key === "objectClause");
    expect(embedded).toBeDefined();
    expect(embedded?.requiredFunctions).not.toContain("object");
    expect(embedded?.requiredFunctions).not.toContain("complement");
  });

  it("keeps the reviewed non-verbal governor frontier out of this narrow migration", () => {
    const predicate = rule("clause.object-content").constituents.find((item) => item.key === "predicate");
    expect(predicate).toMatchObject({
      category: "Predicate",
      requiredValencyFrames: ["clausal-complement"],
    });
    expect(rule("predicate.verb.lexical").constituents[0]?.allowedUpos).toEqual(["VERB"]);
  });
});
