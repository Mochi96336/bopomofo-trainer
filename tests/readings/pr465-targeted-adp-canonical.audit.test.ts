import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../../src/curriculum/formal-syntax-utterance.js";
import { prepareFormalSyntaxExecution } from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import type { CatalogEntry } from "../../src/core/model.js";

/** The canonical grammar is unmodified. Explicitly target its EXISTING
 * declarative -> existential -> preposed AdpositionPhrase derivation.
 * This is a controllable search probe, NOT product-family allocation or a
 * claim of fluent sentence quality.
 */
describe("PR465 source-scoped 給/ADP canonical structural reachability",()=>{
  it("distinguishes rare natural path sampling from actual unreachable reading",()=>{
    const forbidden="word:給:ㄐㄧ3", retained="word:給:ㄍㄟ3";
    const prepared=prepareFormalSyntaxLexicon(PRACTICE_CATALOG,SYNTAX_PROFILES);
    const execution=prepareFormalSyntaxExecution(1);
    const profilesById=new Map(SYNTAX_PROFILES.map(p=>[p.id,p]));
    const output=[];
    for(const treatment of ["before","license"] as const){
      let generated=0, retainedHits=0, invalidHits=0;
      const failureReasons:Record<string,number>={};
      const examples=[];
      for(let seed=0;seed<16;seed++){
        const result=composeFormalSyntaxUtterances({
          eligibleEntries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,rules:FORMAL_SYNTAX_RULES,
          samplingMode:"raw", lexicalSampling:"written-form",
          structuralTarget:{
            rootProductionRuleId:"sentence.declarative",
            nestedProductionTargets:[
              {parentRuleId:"sentence.declarative",constituentKey:"clause",childRuleId:"clause.existential"},
              {parentRuleId:"clause.existential",constituentKey:"locative",childRuleId:"phrase.adposition.preposed",exactCount:1},
            ],
          },
          bounds:execution.bounds,minimumLexicalEntries:2,
          random:createSeededRandom("pr465:adp-path:"+seed),
          entryWeight:(entry:CatalogEntry)=>entry.id===retained||entry.id===forbidden?1_000_000:1,
          maximumCandidates:1,maximumAttempts:64,
          ...PRODUCT_READING_POLICY,
          readingEligibility:(entry,profile,slot,prev)=>
            PRODUCT_READING_POLICY.readingEligibility(entry,profile,slot,prev)
            && !(treatment==="license" && profile.upos==="ADP" && entry.id===forbidden),
        },prepared,execution.structuralSamplingContext);
        const chosen=result.candidates[0];
        if(!chosen){
          for(const reason of result.fallbackReasons)failureReasons[reason]=(failureReasons[reason]||0)+1;
          continue;
        }
        generated++;
        expect(chosen.kind).toBe("formal-syntax");
        const upos=(chosen.syntaxProfileIds||[]).map(id=>profilesById.get(id)?.upos);
        for(let k=0;k<chosen.entries.length;k++){
          if(upos[k]==="ADP"&&chosen.entries[k]!.id===forbidden)invalidHits++;
          if(upos[k]==="ADP"&&chosen.entries[k]!.id===retained){
            retainedHits++;
            if(examples.length<5)examples.push({
              seed,text:chosen.text,
              path:chosen.syntaxProductionRuleIds,
              entries:chosen.entries.map(e=>e.id),
              upos,
            });
          }
        }
      }
      expect(invalidHits).toBe(0);
      if(treatment==="before")expect(retainedHits).toBe(0);
      output.push({treatment,generated,retainedHits,invalidHits,failureReasons,examples});
    }
    console.log("PR465_ADP_TARGETED_BEGIN");
    console.log(JSON.stringify({version:"pr465-adp-targeted-v1",fixedSeeds:16,output,
      caveat:"Targeted full canonical grammar with non-product raw root/path targeting and 1e6 weights. Structural reachability only; no grammaticality gold labels."}));
    console.log("PR465_ADP_TARGETED_END");
  },180_000);
});
