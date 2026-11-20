import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { productReadingEligibleWithoutPreviousEntry } from "../src/readings/product-reading-policy.js";
import { excludeUnresolvedReadingGroups } from "../src/readings/reading-frontier.js";

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=="--output"||!args[1])
  throw Error("usage: tsx scripts/export-unresolved-reading-roles.ts --output roles.json");

const entries=new Map(PRACTICE_CATALOG.map(e=>[e.id,e]));
const groups=new Map<string,{word:string,upos:string,ids:Set<string>,profiles:typeof SYNTAX_PROFILES[number][]}>();
for(const profile of SYNTAX_PROFILES){
  const entry=entries.get(profile.entryId);
  if(entry===undefined)throw Error("orphan profile");
  // Static product gates are an upper bound; contextual gates may narrow this.
  if(!productReadingEligibleWithoutPreviousEntry(entry,profile))continue;
  const key=JSON.stringify([entry.prompt.text,profile.upos]);
  const group=groups.get(key)??{word:entry.prompt.text,upos:profile.upos,ids:new Set<string>(),profiles:[]};
  group.ids.add(profile.entryId);
  group.profiles.push(profile);
  groups.set(key,group);
}
const rows=[...groups.values()]
  .filter(g=>g.ids.size>1 && excludeUnresolvedReadingGroups(g.profiles,entries).length===0)
  .map(g=>({
    word:g.word,upos:g.upos,
    readingEntryIds:[...g.ids].sort(),
    readingIdentities:[...g.ids].sort().map(id=>({
      entryId:id,reading:id.slice(("word:"+g.word+":").length).replaceAll("-"," "),
    })),
    runtimeProfileCount:g.profiles.length,
  })).sort((a,b)=>a.word.localeCompare(b.word,"zh-Hant")||a.upos.localeCompare(b.upos));
const distinct=new Set(rows.flatMap(x=>x.readingEntryIds));
const manifest={
  schemaVersion:"unresolved-catalog-reading-role-input-v1",
  policy:"existing product grammar, full catalog, static pre-draw licenses; no pronunciation inference",
  sourceEdition:"20260929",groups:rows,
  distinctWrittenForms:new Set(rows.map(x=>x.word)).size,
  distinctReadingIds:distinct.size,
};
writeFileSync(resolve(args[1]!),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log("UNRESOLVED_ROLE_INPUT "+JSON.stringify({groups:rows.length,distinctWrittenForms:manifest.distinctWrittenForms,distinctReadingIds:distinct.size}));
