import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { inspectHostLexemeReadiness } from "../../src/readings/whole-lexeme-reachability.js";
import { productReadingEligibleWithoutPreviousEntry } from "../../src/readings/product-reading-policy.js";

/**
 * Audit-only source-lexeme inventory:
 * An official headword example proves its OWN lexical reading but never
 * licenses a single-character/one-word profile merely because the host
 * string includes that character. No product rules or catalog IDs are changed.
 */
const CASES = [
  { target:"都",reading:"word:都:ㄉㄨ1",role:"NOUN", hosts:["首都","國都","花都","港都","都城"] },
  { target:"說",reading:"word:說:ㄕㄨㄛ1",role:"NOUN", hosts:["學說","說法","說辭","說明","著書立說"] },
  { target:"號",reading:"word:號:ㄏㄠ4",role:"NOUN", hosts:["號碼","編號","座號","稱號","外號"] },
  { target:"了",reading:"word:了:ㄌㄧㄠ3",role:"VERB", hosts:["了結","不了了之","完了","一了"] },
  { target:"給",reading:"word:給:ㄍㄟ3",role:"ADP", hosts:["送給","借給","留給","給他"] },
] as const;

describe("PR465 five-role sense boundaries and atomic host lexemes", () => {
  it("records exact host catalog identities without promoting a compound reading to the isolated target", () => {
    const profilesById=new Map(SYNTAX_PROFILES.map(p=>[p.id,p]));
    const entriesById=new Map(PRACTICE_CATALOG.map(e=>[e.id,e]));
    const cases=[];
    for(const item of CASES){
      const targetProfiles=SYNTAX_PROFILES.filter(p=>p.entryId===item.reading && p.upos===item.role);
      expect(targetProfiles.length).toBeGreaterThan(0);
      const hosts=[];
      for(const hostText of item.hosts){
        const readiness=inspectHostLexemeReadiness(hostText,PRACTICE_CATALOG,SYNTAX_PROFILES);
        const licensedForProduct=readiness.runtimeProfileIds.filter(id=>{
          const p=profilesById.get(id);
          if(!p)throw Error("unknown host profile "+id);
          const entry=entriesById.get(p.entryId);
          if(!entry)throw Error("unknown host entry "+p.entryId);
          return productReadingEligibleWithoutPreviousEntry(entry,p);
        });
        const hostEntries=readiness.exactEntryIds.map(id=>{
          const e=entriesById.get(id);
          if(!e)throw Error("host entry missing "+id);
          expect(e.prompt.text).toBe(hostText);
          // A host is a separate lexical identity, not a license for its substring.
          expect(e.id).not.toBe(item.reading);
          return {id:e.id,upos:[...new Set(SYNTAX_PROFILES.filter(p=>p.entryId===e.id).map(p=>p.upos))].sort()};
        });
        hosts.push({text:hostText,status:readiness.status,hostEntries,
          licensedProfileCount:licensedForProduct.length});
      }
      cases.push({target:item.target,role:item.role,reading:item.reading,
        sourceLexemeEvidenceOnly:true,
        targetProfileCount:targetProfiles.length,
        hosts});
    }
    console.log("PR465_HOST_COVERAGE_BEGIN");
    console.log(JSON.stringify({version:"pr465-host-boundary-v1",cases,
      warning:"Exact host catalog presence and syntax-profile reachability are NOT generated-sentence lexical-sense gold, and host readings cannot license substring profiles."}));
    console.log("PR465_HOST_COVERAGE_END");
  });
});
