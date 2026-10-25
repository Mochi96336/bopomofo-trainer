import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_CATALOG,SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { reviewedZhongRolePilotEligible } from "../src/readings/zhong-role-pilot.js";
import { reviewedTargetTokens,validateAttestedBank,type ContextBank }
  from "./prototype-attested-reading-selector.js";
import {
  inferExistingReadingFrontier,
  type BlindInference,
} from "./audit-attested-gold-blind-reading.js";

function resultLabel(blind:BlindInference,gold:readonly string[]){
  const matches=blind.distinctTargetPronunciations.some(a=>
    a.targetTokens.length===gold.length &&
    a.targetTokens.every((x,i)=>x===gold[i]));
  if(blind.frontierStatus==="one-pronunciation")
    return matches?"unique-correct":"unique-wrong";
  if(blind.frontierStatus==="multiple-pronunciations")
    return matches?"ambiguous-contains-gold":"ambiguous-excludes-gold";
  return "unsupported";
}
export function compareZhongRoleOnAttestedCases(bank:ContextBank,
  catalog={entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES}) {
  validateAttestedBank(bank);
  const rows=bank.cases.map(row=>{
    const input={
      word:row.sourceTokenText,sourceUpos:row.sourceTokenUpos,
      targetOffset:row.characterOffsetInToken,
    };
    const ordinary=inferExistingReadingFrontier(input,catalog);
    const trial=inferExistingReadingFrontier(input,catalog,reviewedZhongRolePilotEligible);
    const gold=reviewedTargetTokens(row.reviewedCharacterZhuyin);
    const baseline=resultLabel(ordinary,gold);
    const optIn=resultLabel(trial,gold);
    const baseReadings=ordinary.distinctTargetPronunciations.map(x=>x.targetTokens.join("|"));
    const pilotReadings=trial.distinctTargetPronunciations.map(x=>x.targetTokens.join("|"));
    const changed=JSON.stringify(baseReadings)!==JSON.stringify(pilotReadings);
    if(changed && row.sourceTokenText!=="種") {
      throw new Error("Ablation unexpectedly changed an unrelated word: "+row.id);
    }
    return {
      id:row.id,word:row.sourceTokenText,upos:row.sourceTokenUpos,
      baseline,optIn,changed,
      baselineReadings:baseReadings,pilotReadings,
      goldUsedOnlyForScoring:true,
    };
  });
  const count=(property:"baseline"|"optIn")=>Object.fromEntries(
    [...new Set(rows.map(r=>r[property]))].sort().map(k=>[
      k,rows.filter(r=>r[property]===k).length,
    ]));
  return {
    schemaVersion:"attested-zhong-role-opt-in-ablation-v1",
    warning:"Oracle UD UPOS: an opt-in gate trial is not full-context pronunciation prediction and is NOT production approved",
    sourceBlob:bank.source.blobSha,
    baselineStatusCounts:count("baseline"),
    optInStatusCounts:count("optIn"),
    changedRows:rows.filter(row=>row.changed),
    rows,
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const input=process.argv[2]??"research/attested-reading-pilot/cases.json";
  const output=process.argv[3]??"data/generated/attested-zhong-role-opt-in-ablation.json";
  const bank=JSON.parse(readFileSync(input,"utf8")) as ContextBank;
  const report=compareZhongRoleOnAttestedCases(bank);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    warning:report.warning,
    baselineStatusCounts:report.baselineStatusCounts,
    optInStatusCounts:report.optInStatusCounts,
    changedRows:report.changedRows,
  },null,2));
}
