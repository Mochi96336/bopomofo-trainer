import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import {
  type AttestedTarget, selectVerifiedTarget,
  validateAttestedTargetRows, verifiedTargetTokens,
} from "../research/attested-target-selector.js";

const [dataPath="research/data/attested-polyphonic-target-pilot.json",
  outputPath="data/generated/attested-polyphonic-target-pilot-audit.json"] = process.argv.slice(2);
const raw=JSON.parse(await readFile(dataPath,"utf8")) as {
  schemaVersion: string; cases: AttestedTarget[];
};
if(raw.schemaVersion!=="attested-polyphonic-target-pilot-v1")throw new Error("wrong schema");
const cases=raw.cases;
validateAttestedTargetRows(cases);
const catalogBySurface=new Map<string,typeof PRACTICE_CATALOG[number][]>();
for(const entry of PRACTICE_CATALOG){
  const words=catalogBySurface.get(entry.prompt.text)??[];
  words.push(entry);catalogBySurface.set(entry.prompt.text,words);
}
const coverage=cases.map(row=>{
  const entries=catalogBySurface.get(row.target.writtenWord)??[];
  const expected=verifiedTargetTokens(row.target.goldZhuyin);
  const tokenMatch=entries.filter(entry=>{
    const actual=entry.syllables[row.target.characterOffset]?.tokens;
    return actual!==undefined && expected.every(token=>actual.includes(token));
  });
  const otherPronunciation=entries.filter(entry=>{
    const actual=entry.syllables[row.target.characterOffset]?.tokens;
    return actual!==undefined && !expected.every(token=>actual.includes(token));
  });
  return {
    id:row.id,word:row.target.writtenWord,
    status:entries.length===0?"lexeme-absent"
      :tokenMatch.length===0?"gold-target-reading-unavailable":"gold-target-reading-available",
    catalogLexemeCount:entries.length,
    goldCompatibleEntries:tokenMatch.map(e=>e.id),
    competingReadingEntries:otherPronunciation.map(e=>e.id),
    note:"Catalog entry coverage, NOT contextual G2P accuracy.",
  };
});
const scenarios={
  baseline:{},
  weakFourth:{"tone:4":{attempts:16,errors:12}},
  weakThird:{"tone:3":{attempts:16,errors:12}},
  weakJi:{"zhuyin:ㄐ":{attempts:16,errors:12}},
} as const;
const tracks=Object.entries(scenarios).map(([name,evidence])=>{
  const draws=4096;
  const exposure:Record<string,number>={};
  const caseDraws:Record<string,number>={};
  for(let seed=0;seed<draws;seed++){
    const chosen=selectVerifiedTarget(
      cases,evidence,createSeededRandom("attested-target-pilot-v1:"+seed));
    caseDraws[chosen.id]=(caseDraws[chosen.id]??0)+1;
    for(const token of verifiedTargetTokens(chosen.target.goldZhuyin)){
      exposure[token]=(exposure[token]??0)+1;
    }
  }
  return {name,draws,exposure,caseDraws,
    readingsMutable:false,
    description:"Equal baseline weights, production error-rate threshold/boost cap; reviewed target-only labels"};
});
const baseline=tracks.find(t=>t.name==="baseline")!;
const deltas=[
  {cohort:"weakFourth",token:"tone:4"},
  {cohort:"weakThird",token:"tone:3"},
  {cohort:"weakJi",token:"zhuyin:ㄐ"},
].map(({cohort,token})=>{
  const current=tracks.find(t=>t.name===cohort)!;
  const original=baseline.exposure[token]??0;
  const weighted=current.exposure[token]??0;
  return {cohort,token,baselineCount:original,weightedCount:weighted,delta:weighted-original};
});
if(deltas.some(d=>d.delta<=0)){
  throw new Error("target-only proof failed to increase valid target exposure in paired seeds");
}
const report={
  schemaVersion:"attested-target-selector-report-v1",
  scope:"Source-attested context, dictionary-verified TARGET character only; no full-sentence reading labels",
  caseCount:cases.length,
  distinctTargetCharacters:[...new Set(cases.map(c=>c.target.character))].sort(),
  corpusPinyinConflicts:cases.filter(c=>c.target.udPinyinTargetCheck==="conflict").map(c=>({
    id:c.id,udHint:c.origin.udTransliteration,approvedTarget:c.target.goldZhuyin,
  })),
  sourceAndReadingGuarantees: {
    corpusIntegrity:"Validated by pinned blob SHA in independent CI step",
    gold:"MOE dictionary word/sense reading and sentence-level manual screening; not independently double-annotated",
    corpusPinyinIsGold:false,
    allOtherSentenceCharacterReadingsVerified:false,
    directProductionG2PAccuracyMeasured:false,
  },
  catalogCoverage:coverage,
  coverageSummary:{
    supported:coverage.filter(x=>x.status==="gold-target-reading-available").length,
    missingLexeme:coverage.filter(x=>x.status==="lexeme-absent").length,
    missingGoldReading:coverage.filter(x=>x.status==="gold-target-reading-unavailable").length,
  },
  sampling:{evidence:"synthetic 12/16 error records; 4096 fixed seeds per cohort",scenarios:tracks,deltas},
  limitations:[
    "Not complete-sentence Zhuyin: only the named character in each attested lexical context has an independently reviewed reading.",
    "UD original spelling and segmentation do not certify pinyin or phonetic transcription; ten source hints disagree with MOE.",
    "Catalog coverage is not end-to-end natural-context G2P accuracy.",
    "Equal baseline weights deliberately isolate the error-boost mechanism from frequency, naturalness, and production grammar.",
    "No human subject learning effect, automatic grammatical tagging, full sentence fluency judgment, or independent second reviewer.",
  ],
};
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify({
  outputPath,cases:cases.length,untrustedUdHints:report.corpusPinyinConflicts.length,
  coverage:report.coverageSummary,deltas,
  warning:"This is a provenance + target-only sampling pilot, NOT a full-sentence G2P accuracy benchmark."
},null,2));
