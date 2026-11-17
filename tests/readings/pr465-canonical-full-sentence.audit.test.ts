import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../../src/curriculum/formal-syntax-utterance.js";
import { prepareFormalSyntaxExecution } from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { Upos } from "../../src/syntax/types.js";

/**
 * PR #465 **diagnostic**: canonical full product grammar and production reading gates,
 * unlike the earlier minimal custom grammar tests. Fixed seed namespace and isolated
 * target-biased weighting; does NOT claim natural frequency or semantic correctness.
 *
 * The run deliberately reports no-hit cases rather than fabricating successful examples.
 * A target example is NOT a gold label. Any sentence/example below must be independently
 * reviewed for grammar, meaning, reading, and contextual role before release.
 */
const CASES = [
  { text: "都", upos: "NOUN", forbidden: "word:都:ㄉㄡ1", retained: "word:都:ㄉㄨ1" },
  { text: "說", upos: "NOUN", forbidden: "word:說:ㄕㄨㄟ4", retained: "word:說:ㄕㄨㄛ1" },
  { text: "號", upos: "NOUN", forbidden: "word:號:ㄏㄠ2", retained: "word:號:ㄏㄠ4" },
  { text: "了", upos: "VERB", forbidden: "word:了:ㄌㄜ5", retained: "word:了:ㄌㄧㄠ3" },
  { text: "給", upos: "ADP", forbidden: "word:給:ㄐㄧ3", retained: "word:給:ㄍㄟ3" },
] as const satisfies readonly {text:string;upos:Upos;forbidden:string;retained:string}[];

const SAMPLES_PER_CASE = 24;
const profilesById = new Map(SYNTAX_PROFILES.map(p=>[p.id,p]));
const preparedLexicon = prepareFormalSyntaxLexicon(PRACTICE_CATALOG,SYNTAX_PROFILES);
const preparedExecution = prepareFormalSyntaxExecution(1);

describe("PR465 canonical-grammar five-role full-sentence stress probe",()=>{
  it("observes actual production-family realizations and flags unverified senses",()=>{
    const summary = [];
    for(const item of CASES){
      const outcomes=[];
      for(const treatment of ["before","exact-role-license"] as const){
        const examples: Array<{seed:number;text:string;root:string|null;path:readonly string[];readings:string[];slotUpos:string[]}> = [];
        const fallbackReasons: Record<string,number> = {};
        let successful=0, selectedTarget=0, invalidSelected=0;
        const maxExamples=5;
        for(let seed=0;seed<SAMPLES_PER_CASE;seed++){
          const output=composeFormalSyntaxUtterances({
            eligibleEntries:PRACTICE_CATALOG, profiles:SYNTAX_PROFILES,
            lexicalSampling:"written-form", samplingMode:"product-family",
            random:createSeededRandom("pr465:canonical:"+item.text+":"+item.upos+":"+seed),
            maximumCandidates:1, maximumAttempts:64, minimumLexicalEntries:2,
            bounds:preparedExecution.bounds,
            entryWeight:(e:CatalogEntry)=>e.id===item.forbidden||e.id===item.retained ? 1_000_000 : 1,
            ...PRODUCT_READING_POLICY,
            readingEligibility:(entry,profile,slot,prev)=>
              PRODUCT_READING_POLICY.readingEligibility(entry,profile,slot,prev)
              && !(treatment==="exact-role-license" && profile.upos===item.upos && entry.id===item.forbidden),
          },preparedLexicon,preparedExecution.structuralSamplingContext);
          const picked=output.candidates[0];
          if(picked===undefined){
            for(const reason of output.fallbackReasons)fallbackReasons[reason]=(fallbackReasons[reason]||0)+1;
            continue;
          }
          successful++;
          expect(picked.kind).toBe("formal-syntax");
          expect(picked.syntaxProductionRuleIds?.length).toBeGreaterThan(0);
          expect(picked.syntaxProfileIds?.length).toBe(picked.entries.length);
          const slotUpos=picked.syntaxProfileIds!.map(id=>{
            const upos=profilesById.get(id)?.upos;
            if(!upos)throw Error("missing realized profile "+id);
            return upos;
          });
          for(let j=0;j<picked.entries.length;j++){
            if(picked.entries[j]!.id===item.forbidden && slotUpos[j]===item.upos)invalidSelected++;
          }
          const indices=picked.entries.flatMap((entry,j)=>entry.id===item.retained&&slotUpos[j]===item.upos?[j]:[]);
          if(indices.length>0){
            selectedTarget++;
            if(examples.length<maxExamples){
              examples.push({seed,text:picked.text,root:picked.syntaxRootRuleId??null,
                path:picked.syntaxProductionRuleIds??[],readings:picked.entries.map(e=>e.id),
                slotUpos});
            }
          }
        }
        expect(invalidSelected).toBe(0);
        if(treatment==="before")expect(selectedTarget).toBe(0);
        outcomes.push({treatment,seedCount:SAMPLES_PER_CASE,successful,selectedTarget,
          invalidSelected,fallbackReasons,examples});
      }
      summary.push({word:item.text,upos:item.upos,forbidden:item.forbidden,retained:item.retained,outcomes});
    }
    console.log("PR465_CANONICAL_PROBE_BEGIN");
    console.log(JSON.stringify({version:"pr465-canonical-grammar-stress-v1",
      base:"2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1",
      cases:summary,limitations:[
        "Target/forbidden IDs are weighted 1e6 and all other entries 1: this is a reachability stress test, NOT normal product exposure.",
        "Full official product grammar and bounds are used; 24 fixed seeds per case/treatment.",
        "Generated sentences are NOT independently verified for grammatical or semantic correctness.",
        "No-hit is a measured non-observation, not proof of structural impossibility."
      ]}));
    console.log("PR465_CANONICAL_PROBE_END");
  },240_000);
});
