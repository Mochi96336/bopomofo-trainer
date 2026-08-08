import { describe, expect, it } from "vitest";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

class ConstantRandom implements RandomSource {
  public constructor(private readonly value: number) {}
  public next(): number {
    return this.value;
  }
}

function entry(id: string, text: string): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(
  id: string,
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
  relation: string,
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: { [relation]: 1 },
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function rules(ids: readonly string[]) {
  const keep = new Set(ids);
  return FORMAL_SYNTAX_RULES.filter((item) => keep.has(item.id));
}

describe("formal syntax lexical bindings", () => {
  it("realizes A-not-A with one repeated predicate entry, never two unrelated verbs", () => {
    const eat = entry("word:吃:ㄔ1", "吃");
    const sleep = entry("word:睡:ㄕㄨㄟ4", "睡");
    const not = entry("word:不:ㄅㄨ4", "不");

    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [eat, sleep, not],
      profiles: [
        profile("profile:eat", eat.id, "VERB", ["predicate"], ["intransitive"], "root"),
        profile("profile:sleep", sleep.id, "VERB", ["predicate"], ["intransitive"], "root"),
        profile("profile:not", not.id, "ADV", ["adverbial"], ["avalent"], "advmod"),
      ],
      entryWeightsById: {
        [eat.id]: 1,
        [sleep.id]: 0,
        [not.id]: 1,
      },
      random: new ConstantRandom(0),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: rules(["sentence.a-not-a-question"]),
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.text).toBe("吃不吃");
    expect(result.candidates[0]?.entries.map((item) => item.id)).toEqual([
      eat.id,
      not.id,
      eat.id,
    ]);
    expect(result.candidates[0]?.text).not.toBe("吃不睡");
  });

  it("keeps transitive A-not-A predicates transitive when an object is present", () => {
    const eat = entry("word:吃:ㄔ1", "吃");
    const sleep = entry("word:睡:ㄕㄨㄟ4", "睡");
    const not = entry("word:不:ㄅㄨ4", "不");
    const rice = entry("word:飯:ㄈㄢ4", "飯");

    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [eat, sleep, not, rice],
      profiles: [
        profile("profile:eat", eat.id, "VERB", ["predicate"], ["transitive"], "root"),
        profile("profile:sleep", sleep.id, "VERB", ["predicate"], ["intransitive"], "root"),
        profile("profile:not", not.id, "ADV", ["adverbial"], ["avalent"], "advmod"),
        profile("profile:rice", rice.id, "NOUN", ["object"], ["avalent"], "obj"),
      ],
      entryWeightsById: {
        [eat.id]: 1,
        [sleep.id]: 100,
        [not.id]: 1,
        [rice.id]: 1,
      },
      random: new ConstantRandom(0),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: rules([
        "sentence.a-not-a-transitive-question",
        "phrase.noun.bare",
        "phrase.nominal-head.noun",
      ]),
    });

    expect(result.candidates[0]?.text).toBe("吃不吃飯");
    expect(result.candidates[0]?.text).not.toContain("睡");
  });
});
