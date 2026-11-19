import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { excludeUnresolvedReadingGroups } from "../../src/readings/reading-frontier.js";
import {
  compileGuidedTypingFrontier, parseGuidedTypingManifest,
} from "../../src/readings/reviewed-guided-typing-frontier.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const path = new URL("../../data/readings/reviewed-guided-typing-readings.json", import.meta.url);
const raw = JSON.parse(readFileSync(path,"utf8")) as unknown;
const manifest = parseGuidedTypingManifest(raw);
const compiled = compileGuidedTypingFrontier(PRACTICE_CATALOG,SYNTAX_PROFILES,raw);
const entries = new Map(PRACTICE_CATALOG.map(e=>[e.id,e]));
function group(word:string,upos:string): readonly RuntimeSyntaxProfile[] {
  return SYNTAX_PROFILES.filter(p=>entries.get(p.entryId)?.prompt.text===word && p.upos===upos);
}
const identities = (profiles:readonly RuntimeSyntaxProfile[]) =>
  [...new Set(profiles.map(p=>p.entryId))].sort();

describe("reviewed typing-only phonetic targets vs free variants",()=>{
  it("checks exact official-source pins, case-specific POS, and full candidate identity sets",()=>{
    expect(manifest.groups).toHaveLength(2);
    for(const item of manifest.groups){
      const candidates=group(item.word,item.upos);
      expect(identities(candidates)).toEqual(item.readings.map(r=>r.entryId).sort());
      expect(identities(excludeUnresolvedReadingGroups(candidates,entries))).toEqual([]);
      expect(identities(compiled.filterForMode("guided")(candidates,entries)))
        .toEqual(item.readings.map(r=>r.entryId).sort());
      expect(identities(compiled.filterForMode("recall")(candidates,entries))).toEqual([]);
    }
  });
  it("never allows different POS groups or unreviewed polyphones",()=>{
    for(const [word,upos] of [["看","NOUN"],["東西","VERB"],["說","VERB"],["女","PART"]] as const){
      const candidates=group(word,upos);
      const guided=compiled.filterForMode("guided")(candidates,entries);
      const baseline=excludeUnresolvedReadingGroups(candidates,entries);
      expect(guided).toEqual(baseline);
    }
  });
  it("stops on a third reading added to an approved group",()=>{
    const candidates=group("看","VERB");
    const original=entries.get("word:看:ㄎㄢ1")!;
    const third={...original,id:"word:看:ㄎㄢ5"};
    const thirdProfile={...candidates[0]!,id:"audit:third-reading",entryId:third.id};
    const newEntries=new Map([...entries,[third.id,third]]);
    expect(compiled.filterForMode("guided")([...candidates,thirdProfile],newEntries)).toEqual([]);
  });
  it("fails closed on unpinned, duplicated or unreviewed manifest identities",()=>{
    function mutate(edit:(copy:any)=>void){
      const copy=JSON.parse(JSON.stringify(raw));
      edit(copy);
      return ()=>parseGuidedTypingManifest(copy);
    }
    expect(mutate(x=>x.groups[0].readings[0].revisedSourceId="")).toThrow();
    expect(mutate(x=>x.groups[0].officialPage="https://example.org/1")).toThrow();
    expect(mutate(x=>x.groups[0].readings.push({...x.groups[0].readings[0]}))).toThrow();
    expect(mutate(x=>x.groups[0].upos="PART")).toThrow();
    expect(mutate(x=>x.groups[0].extra="misleading")).toThrow();
    expect(mutate(x=>x.groups[0].readings[0].entryId="word:看:ㄎㄢ3")).not.toThrow();
    // A syntactically valid but unreviewed identity is rejected at the catalog gate.
    const tampered=JSON.parse(JSON.stringify(raw));
    tampered.groups[0].readings[0].entryId="word:看:ㄎㄢ3";
    expect(()=>compileGuidedTypingFrontier(PRACTICE_CATALOG,SYNTAX_PROFILES,tampered)).toThrow();
  });
});
