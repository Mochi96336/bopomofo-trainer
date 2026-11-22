import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { selectIsolatedReadingExploration } from "../../src/curriculum/isolated-reading-exploration.js";

describe("baseline-preserving optional reading exploration", () => {
  const original = Object.freeze({ id: "unchanged-sentence", entries: ["A", "B"] });
  it("never attempts a candidate when exploration is disabled", () => {
    let called = 0;
    const result = selectIsolatedReadingExploration({
      baseline: original, seed: "round-01", explorationRate: 0,
      maximumExplorationAttempts: 2,
      generateTrial: () => { called++; return {id:"unwanted", entries:["C"]}; },
      gainsVerifiedTarget: () => true,
    });
    expect(result).toEqual({chosen:original,outcome:"skipped",trialAttempts:0});
    expect(result.chosen).toBe(original);
    expect(called).toBe(0);
  });
  it("does not replace the baseline for unsuccessful or irrelevant trials", () => {
    let calls = 0;
    const result = selectIsolatedReadingExploration({
      baseline: original, seed:"round-02",explorationRate:1,maximumExplorationAttempts:3,
      generateTrial: () => {calls++;return calls===2?{id:"changed-no-new-reading",entries:["D"]}:null;},
      gainsVerifiedTarget: () => false,
    });
    expect(result).toEqual({chosen:original,outcome:"reverted",trialAttempts:3});
    expect(result.chosen).toBe(original);
    expect(calls).toBe(3);
  });
  it("accepts a genuinely new target only after the independent retry", () => {
    const usedSeeds:string[] = [];
    const replacement={id:"contains-source-attested-new-reading",entries:["A","C"]};
    const run = () => selectIsolatedReadingExploration({
      baseline:original,seed:"round-03",explorationRate:1,maximumExplorationAttempts:3,
      generateTrial: (seed) => {
        usedSeeds.push(seed);
        return seed.endsWith(":1")?replacement:{id:"unrelated",entries:["D"]};
      },
      gainsVerifiedTarget: (trial) => trial===replacement,
    });
    const one=run();
    expect(one).toEqual({chosen:replacement,outcome:"restored",trialAttempts:2});
    expect(usedSeeds).toEqual([
      "round-03:reading-explore-candidate-v1:0",
      "round-03:reading-explore-candidate-v1:1",
    ]);
    usedSeeds.length=0;
    expect(run()).toEqual(one);
  });
  it("never consumes draws from the baseline random stream", () => {
    const first=createSeededRandom("same-original-round");
    const second=createSeededRandom("same-original-round");
    const initial=first.next();
    expect(initial).toBe(second.next());
    selectIsolatedReadingExploration({
      baseline:original,seed:"same-original-round",explorationRate:1,
      maximumExplorationAttempts:2,
      generateTrial: seed => {
        const random=createSeededRandom(seed);
        for(let k=0;k<30;k++)random.next();
        return null;
      },
      gainsVerifiedTarget:()=>true,
    });
    expect(first.next()).toBe(second.next());
  });
  it("rejects invalid budget settings", () => {
    for(const rate of [-0.1,1.01,Number.NaN]){
      expect(()=>selectIsolatedReadingExploration({
        baseline:original,seed:"x",explorationRate:rate,maximumExplorationAttempts:2,
        generateTrial:()=>null,gainsVerifiedTarget:()=>false,
      })).toThrow();
    }
    expect(()=>selectIsolatedReadingExploration({
      baseline:original,seed:"x",explorationRate:0.2,maximumExplorationAttempts:0,
      generateTrial:()=>null,gainsVerifiedTarget:()=>false,
    })).toThrow();
  });
});
