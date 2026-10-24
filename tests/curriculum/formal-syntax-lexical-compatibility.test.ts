import { describe, expect, it } from "vitest";
import {
  buildLexicalCompatibilityIndex,
  type LexicalCompatibilityArtifact,
} from "../../src/compatibility/lexical-pairs.js";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

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
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

const rule: ProductionRule = {
  id: "sentence.compatibility-test",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "subject",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["PRON"],
      requiredFunctions: ["subject"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
    {
      key: "predicate",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["VERB"],
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["transitive"],
      requiredFeatures: {},
    },
    {
      key: "object",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: ["object"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "object"],
  }],
  constraints: [],
  positiveFixtureIds: ["fixture:positive"],
  negativeFixtureIds: ["fixture:negative"],
};

const punctuatedRule: ProductionRule = {
  ...rule,
  id: "sentence.compatibility-punctuation-test",
  constituents: [
    rule.constituents[0]!,
    rule.constituents[1]!,
    {
      key: "punctuation",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["PUNCT"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
    rule.constituents[2]!,
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "punctuation", "object"],
  }],
};

function compatibility() {
  const core = {
    adapterVersion: "fixture",
    schemaVersion: "ud-lexical-compatibility-v1" as const,
    source: { sourceId: "fixture" },
    candidateCount: 4,
    minimumPairCount: 1,
    surfaceObservationCount: 2,
    dependencyObservationCount: 0,
    surfacePairs: [{ leftText: "吃", rightText: "飯", count: 2, score: 1 }],
    dependencyPairs: [],
  } satisfies Omit<LexicalCompatibilityArtifact, "determinismDigest">;
  return buildLexicalCompatibilityIndex({
    ...core,
    determinismDigest: sha256Canonical(core),
  });
}

describe("formal syntax lexical compatibility weighting", () => {
  const subject = entry("entry:subject", "我");
  const verb = entry("entry:verb", "吃");
  const food = entry("entry:food", "飯");
  const theory = entry("entry:theory", "理論");
  const entries = [subject, verb, food, theory];
  const profiles = [
    profile("profile:subject", subject.id, "PRON", ["subject"], ["avalent"]),
    profile("profile:verb", verb.id, "VERB", ["predicate"], ["transitive"]),
    profile("profile:food", food.id, "NOUN", ["object"], ["avalent"]),
    profile("profile:theory", theory.id, "NOUN", ["object"], ["avalent"]),
  ];
  const weights = Object.fromEntries(entries.map((item) => [item.id, 1]));

  it("preserves the original selection when no compatibility evidence is supplied", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [rule],
    });
    expect(result.candidates[0]?.text).toBe("我吃理論");
  });

  it("boosts an observed pair without making the unseen pair illegal", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      lexicalCompatibility: compatibility(),
      lexicalCompatibilityMaximumBoost: 4,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [rule],
    });
    expect(result.candidates[0]?.text).toBe("我吃飯");
  });

  it("does not apply surface-pair evidence across punctuation", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      lexicalCompatibility: compatibility(),
      lexicalCompatibilityMaximumBoost: 4,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [punctuatedRule],
    });
    expect(result.candidates[0]?.text).toBe("我吃理論");
  });
});


class CountingConstantRandom implements RandomSource {
  public calls=0;
  public constructor(private readonly value:number) {}
  public next():number {
    this.calls++;
    return this.value;
  }
}

describe("research-only same-written-lexeme reading fallback",()=>{
  const subject=entry("entry:research-subject","我");
  const rejected=entry("entry:research-j3","給");
  const replacement=entry("entry:research-gei3","給");
  const other=entry("entry:research-other","寄送");
  const object=entry("entry:research-object","信");
  const lexicon=[subject,rejected,replacement,other,object];
  const profiles=[
    profile("profile:rsubject",subject.id,"PRON",["subject"],["avalent"]),
    profile("profile:rj3",rejected.id,"VERB",["predicate"],["transitive"]),
    profile("profile:rgei3",replacement.id,"VERB",["predicate"],["transitive"]),
    profile("profile:rother",other.id,"VERB",["predicate"],["transitive"]),
    profile("profile:robject",object.id,"NOUN",["object"],["avalent"]),
  ];
  const weights=Object.fromEntries(lexicon.map(x=>[x.id,
    x.id===rejected.id||x.id===other.id?100:1,
  ]));
  const create=(prefer:boolean)=>{
    const result=composeFormalSyntaxUtterances({
      eligibleEntries:lexicon,profiles,
      readingEligibility:(candidate)=>candidate.id!==rejected.id,
      ...(prefer?{readingResamplePreference:()=> "same-surface-first" as const}:{}),
      entryWeightsById:weights,
      // A fixed draw selects rejected from high-weight entries, but without
      // same-surface rescue a different high-weight word wins resampling.
      random:new ConstantRandom(0.1),
      maximumCandidates:1,maximumAttempts:1,rules:[rule],
    });
    expect(result.candidates).toHaveLength(1);
    return result.candidates[0]!;
  };
  it("prefers another licensed pronunciation of the same exact written WORD",()=>{
    const ordinary=create(false);
    const preserve=create(true);
    expect(ordinary.text).toBe("我寄送信");
    expect(preserve.text).toBe("我給信");
    expect(ordinary.entries[1]!.id).toBe(other.id);
    expect(preserve.entries[1]!.id).toBe(replacement.id);
    expect(preserve.entries[1]!.id).not.toBe(rejected.id);
  });
  it("never changes default selection or consumes an extra random draw when a reading is already licensed",()=>{
    const args={
      eligibleEntries:lexicon,profiles,
      readingEligibility:()=>true,
      entryWeightsById:weights,
      maximumCandidates:1,maximumAttempts:1,rules:[rule],
    };
    const a=composeFormalSyntaxUtterances({
      ...args,random:new ConstantRandom(0.1),
    }).candidates[0];
    const b=composeFormalSyntaxUtterances({
      ...args,readingResamplePreference:()=> "same-surface-first" as const,
      random:new ConstantRandom(0.1),
    }).candidates[0];
    expect(b?.entries.map(x=>x.id)).toEqual(a?.entries.map(x=>x.id));
  });
  it("consumes no EXTRA random draw with a sole licensed same-word alternative",()=>{
    const scenario=(preference:"same-surface-first"|"same-surface-singleton-no-draw")=>{
      const random=new CountingConstantRandom(0.1);
      const result=composeFormalSyntaxUtterances({
        eligibleEntries:lexicon,profiles,
        readingEligibility:(candidate)=>candidate.id!==rejected.id,
        readingResamplePreference:()=>preference,
        entryWeightsById:weights,
        random,maximumCandidates:1,maximumAttempts:1,rules:[rule],
      });
      expect(result.candidates).toHaveLength(1);
      return {result:result.candidates[0]!,calls:random.calls};
    };
    const old=scenario("same-surface-first");
    const next=scenario("same-surface-singleton-no-draw");
    expect(old.result.entries.map(x=>x.id))
      .toEqual(next.result.entries.map(x=>x.id));
    expect(next.result.entries[1]?.id).toBe(replacement.id);
    expect(next.calls).toBe(old.calls-1);
  });
  it("still draws when more than one compatible same-written-word profile exists",()=>{
    const another=entry("entry:research-gei-alternate","給");
    const extraProfile=profile("profile:gei-alternate",another.id,
      "VERB",["predicate"],["transitive"]);
    const make=(preference:"same-surface-first"|"same-surface-singleton-no-draw")=>{
      const random=new CountingConstantRandom(0.1);
      const result=composeFormalSyntaxUtterances({
        eligibleEntries:[...lexicon,another],
        profiles:[...profiles,extraProfile],
        readingEligibility:(entry)=>entry.id!==rejected.id,
        readingResamplePreference:()=>preference,
        entryWeightsById:{...weights,[another.id]:1},
        random,maximumCandidates:1,maximumAttempts:1,rules:[rule],
      });
      expect(result.candidates).toHaveLength(1);
      return {candidate:result.candidates[0]!,calls:random.calls};
    };
    const old=make("same-surface-first");
    const next=make("same-surface-singleton-no-draw");
    expect(next.calls).toBe(old.calls);
    expect(next.candidate.entries.map(x=>x.id))
      .toEqual(old.candidate.entries.map(x=>x.id));
  });
});
