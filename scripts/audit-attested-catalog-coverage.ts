import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PRACTICE_CATALOG } from "../src/app/generated/catalog.js";
import { reviewedTargetTokens, validateAttestedBank, type ContextBank } from "./prototype-attested-reading-selector.js";

/**
 * A READ-ONLY exact-word catalog *coverage* check, NOT contextual G2P.
 * A word existing with the correct reading does not establish that the
 * production syntax selector chooses it for this natural sentence.
 */
const path=process.argv[2]??"research/attested-reading-pilot/cases.json";
const output=process.argv[3]??"data/generated/attested-catalog-coverage.json";
const bank=JSON.parse(readFileSync(path,"utf8")) as ContextBank;
validateAttestedBank(bank);
const results=bank.cases.map(row=>{
 const sameText=PRACTICE_CATALOG.filter(entry=>entry.prompt.text===row.sourceTokenText);
 const wordLength=[...row.sourceTokenText].length;
 const aligned=sameText.filter(entry=>entry.syllables.length===wordLength);
 const expected=reviewedTargetTokens(row.reviewedCharacterZhuyin);
 const matches=aligned.filter(entry=>{
  const candidate=entry.syllables[row.characterOffsetInToken]?.tokens;
  return candidate?.length===expected.length
    && candidate.every((x,i)=>x===expected[i]);
 });
 const mismatches=aligned.filter(entry=>!matches.includes(entry));
 const status=sameText.length===0 ? "word-not-in-practice-catalog"
   : aligned.length===0 ? "no-codepoint-syllable-alignment"
   : matches.length===0 ? "reviewed-reading-not-in-aligned-entries"
   : mismatches.length>0 ? "correct-reading-present-but-ambiguous"
   : "reviewed-reading-present";
 return {
  id:row.id,sourceSentId:row.sourceSentId,
  sourceTokenText:row.sourceTokenText,targetCharacter:row.targetCharacter,
  reviewedCharacterZhuyin:row.reviewedCharacterZhuyin,
  status,exactWrittenWordEntries:sameText.length,
  alignedEntries:aligned.length,
  exactCorrectReadingEntries:matches.length,
  otherReadingEntries:mismatches.length,
  exactEntryIds:matches.map(x=>x.id),
 };
});
const counts=Object.fromEntries([...new Set(results.map(x=>x.status))].sort().map(k=>[
 k,results.filter(x=>x.status===k).length,
]));
const report={
 schemaVersion:"attested-exact-word-catalog-coverage-v1",
 purpose:"Read-only lexical candidate presence only. NOT natural-sentence disambiguation correctness.",
 sourceCaseCount:results.length,
 practiceCatalogSize:PRACTICE_CATALOG.length,
 statuses:counts,rows:results,
 limitations:[
  "The practice catalog may not contain an attested word. Absence does not mean the word's pronunciation is impossible in Mandarin.",
  "An exact-word reading match does not establish product selection or sense disambiguation for this source sentence.",
  "A mismatched or unaligned reading is not scored as a wrong output by the app; no sentence was passed through the app's parser.",
  "Character index matches source lexical form only; no independent automatic segmentation or full-sentence Bopomofo gold.",
 ],
};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify({output,sourceCaseCount:report.sourceCaseCount,practiceCatalogSize:report.practiceCatalogSize,statuses:report.statuses},null,2));
