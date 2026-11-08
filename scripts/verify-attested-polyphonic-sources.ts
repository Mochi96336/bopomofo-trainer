import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AttestedTarget } from "../research/attested-target-selector.js";
import { validateAttestedTargetRows } from "../research/attested-target-selector.js";

const [dataPath, corpusDir] = process.argv.slice(2);
if(!dataPath || !corpusDir)throw new Error(
  "usage: npx tsx scripts/verify-attested-polyphonic-sources.ts DATA.json CONLLU-DIR"
);
const data=JSON.parse(readFileSync(dataPath,"utf8")) as {cases:readonly AttestedTarget[]};
validateAttestedTargetRows(data.cases);
const fileBySplit={train:"zh_gsd-ud-train.conllu",dev:"zh_gsd-ud-dev.conllu",test:"zh_gsd-ud-test.conllu"} as const;
let verified=0;
for(const split of ["train","dev","test"] as const){
  const rows=data.cases.filter(row=>row.origin.split===split);
  if(!rows.length)continue;
  const content=readFileSync(join(corpusDir,fileBySplit[split]));
  const blobSha=createHash("sha1")
    .update(`blob ${content.length}\0`)
    .update(content).digest("hex");
  const recorded=new Set(rows.map(x=>x.origin.sourceBlobSha));
  if(recorded.size!==1 || !recorded.has(blobSha)){
    throw new Error("UD source content changed since review for "+split+
      "; DO NOT silently replace the gold corpus. Expected "+[...recorded].join(",")+
      " but received "+blobSha);
  }
  const blocks=new Map<string,string>();
  for(const text of content.toString("utf8").split(/\n\s*\n/)){
    const id=text.match(/^# sent_id = (.+)$/m)?.[1];
    if(id)blocks.set(id,text);
  }
  for(const row of rows){
    const b=blocks.get(row.origin.sourceSentenceId);
    if(!b)throw new Error("missing corpus sentence "+row.id);
    const sentence=b.match(/^# text = (.+)$/m)?.[1];
    if(sentence!==row.origin.sourceSentence)throw new Error("source sentence mismatch "+row.id);
    const raw=b.split("\n").find(line=>line.startsWith(row.origin.udTokenIndex+"\t"));
    if(!raw)throw new Error("missing UD token "+row.id);
    const fields=raw.split("\t");
    const romanized=fields[9]?.match(/(?:^|\|)Translit=([^|]+)/)?.[1];
    if(fields[1]!==row.origin.udTokenText
      || fields[3]!==row.origin.udUpos
      || romanized!==row.origin.udTransliteration){
      throw new Error("tokenization/UPOS/transliteration provenance changed "+row.id);
    }
    verified++;
  }
}
if(verified!==data.cases.length)throw new Error("source provenance incomplete");
console.log(JSON.stringify({verified,blobs:3,source:"pinned Git blob SHA, sentence ID, full text and exact UD token line",notes:"UD Translit was checked as provenance only; not reading gold"},null,2));
