import { describe, expect, it } from "vitest";
import {
  indexUdOccurrenceChildren,
  parseUdOccurrenceSentences,
} from "../../scripts/ud-occurrence-source.js";

const EXACT_RELATIONS = [
  "# sent_id = ba-passive",
  "1\t書\t_\tNOUN\t_\t_\t4\tobl:patient\t_\t_",
  "2\t把\t_\tADP\t_\t_\t1\tcase\t_\t_",
  "3\t他\t_\tPRON\t_\t_\t4\tnsubj:pass\t_\t_",
  "4\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "5\t人\t_\tNOUN\t_\t_\t4\tobl:agent\t_\t_",
  "6\t被\t_\tADP\t_\t_\t5\tcase\t_\t_",
  "",
].join("\n");

describe("generic UD occurrence source", () => {
  it("preserves exact dependency subtypes for construction evidence", () => {
    const [tokens] = parseUdOccurrenceSentences(EXACT_RELATIONS);
    expect(tokens?.map((token) => token.relation)).toEqual([
      "obl:patient",
      "case",
      "nsubj:pass",
      "root",
      "obl:agent",
      "case",
    ]);
  });

  it("indexes exact-relation children without collapsing subtypes", () => {
    const [tokens] = parseUdOccurrenceSentences(EXACT_RELATIONS);
    expect(tokens).toBeDefined();
    const children = indexUdOccurrenceChildren(tokens ?? []);
    expect(children.get(4)?.map((token) => token.relation).sort()).toEqual([
      "nsubj:pass",
      "obl:agent",
      "obl:patient",
    ]);
    expect(children.get(1)?.[0]?.form).toBe("把");
    expect(children.get(5)?.[0]?.form).toBe("被");
  });
});
