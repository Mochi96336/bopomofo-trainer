import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildSelectedMoeHeadwordCoverage,
  type Projection,
  type SelectedExposureReport,
} from "../src/readings/selected-moe-headword-coverage.js";

/**
 * Research-only audit of the actually selected identities, NOT a new
 * eligibility gate. The projections are intentionally non-exhaustive.
 * An unmatched reading is not evidence of an invalid pronunciation.
 */
async function main(): Promise<void> {
  const args=process.argv.slice(2);
  let baseline="data/generated/polyphonic-context-standard-guo-trial.json";
  let concised="data/readings/moe-concised-2014_20260626-active-catalog.json";
  let revised="data/readings/moe-revised-2015_20260625-active-catalog-fallback.json";
  let output="data/generated/selected-moe-headword-coverage.json";
  for(let i=0;i<args.length;i+=2){
    const name=args[i], value=args[i+1];
    if(value===undefined)throw new Error("missing value for "+name);
    if(name==="--baseline")baseline=value;
    else if(name==="--concised")concised=value;
    else if(name==="--revised")revised=value;
    else if(name==="--output")output=value;
    else throw new Error("unknown option: "+name);
  }
  const [a,b,c]=await Promise.all([
    readFile(baseline,"utf8"),
    readFile(concised,"utf8"),
    readFile(revised,"utf8"),
  ]);
  const result=buildSelectedMoeHeadwordCoverage(
    JSON.parse(a) as SelectedExposureReport,
    JSON.parse(b) as Projection,
    JSON.parse(c) as Projection,
  );
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    schemaVersion:result.schemaVersion,
    sampleCount:result.sampleCount,
    totalSelectedOccurrences:result.totalSelectedOccurrences,
    uniqueSelectedIdentities:result.uniqueSelectedIdentities,
    countByStatus:result.countByStatus,
    occurrencesByStatus:result.occurrencesByStatus,
    topReviewLeads:result.identities.filter(i=>i.needsReferenceReview).slice(0,30).map(i=>({
      entryId:i.entryId,occurrences:i.occurrences,status:i.status,
      projection:i.projection,seedIndices:i.seedIndices.slice(0,5),
    })),
    caveat:result.caveat,
  },null,2));
}
await main();
