import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  compileReviewedReadingRoleProfiles,
  parseReviewedReadingRoleManifest,
} from "../src/readings/attested-reading-role-profiles.js";
import { productReadingEligibleWithoutPreviousEntry, PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";

/**
 * Read-only reproducible entry point for a reviewed reading-role batch.
 *
 * Run after app:catalog:
 *   npx tsx scripts/audit-reviewed-reading-role-evidence.ts
 *   npx tsx scripts/audit-reviewed-reading-role-evidence.ts --manifest path/to/reviewed.json
 *   npx tsx scripts/audit-reviewed-reading-role-evidence.ts --output /tmp/report.json
 * The optional output contains every remaining conflict group's exact reading IDs.
 *
 * No UD reading labels inferred; no source corpus, app catalog or product
 * policy is mutated. A role is a candidate for safe restoration, not a
 * sentence-specific pronunciation gold label.
 */
function parseArgs(args: readonly string[]): {manifest: string; output: string|null} {
  const options = {
    manifest: new URL("../data/readings/reviewed-reading-role-evidence.json", import.meta.url).pathname,
    output: null as string|null,
  };
  for (let i=0;i<args.length;i++) {
    const option=args[i]!;
    if (option!=="--manifest"&&option!=="--output") throw Error("unknown argument "+option);
    const value=args[++i];
    if (!value || value.startsWith("--")) throw Error(option+" requires a path");
    if (option==="--manifest") options.manifest=resolve(value);
    else options.output=resolve(value);
  }
  return options;
}

function staticallyAbstainedGroups(entries:readonly CatalogEntry[],profiles:readonly RuntimeSyntaxProfile[]) {
  const byId=new Map(entries.map(e=>[e.id,e]));
  const byGroup=new Map<string,RuntimeSyntaxProfile[]>();
  for (const p of profiles) {
    const e=byId.get(p.entryId);
    if(!e||!productReadingEligibleWithoutPreviousEntry(e,p))continue;
    const key=JSON.stringify([e.prompt.text,p.upos]);
    byGroup.set(key,[...(byGroup.get(key)??[]),p]);
  }
  return new Map([...byGroup].filter(([,ps])=>
    new Set(ps.map(p=>p.entryId)).size>1
      && PRODUCT_READING_POLICY.readingFrontierFilter(ps,byId).length===0
  ).map(([key,profiles])=>{
    const [word,upos]=JSON.parse(key) as [string,string];
    return [key,{
      word, upos,
      readingEntryIds:[...new Set(profiles.map(p=>p.entryId))].sort(),
      sharedSourceFunctions:[...new Set(profiles.flatMap(p=>p.functions))].sort(),
      evidenceStatus:"unreviewed-reading-role" as const,
    }] as const;
  }));
}

const args=parseArgs(process.argv.slice(2));
const manifest=parseReviewedReadingRoleManifest(
  JSON.parse(await readFile(args.manifest,"utf8")) as unknown);
const whole={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const knownIds=new Set(PRACTICE_CATALOG.map(e=>e.id));
for(const row of manifest.rows) {
  if(!knownIds.has(row.entryId))throw Error("manifest reading identity absent from full product catalog: "+row.entryId);
}
// Compile once with full coverage before evaluating tier subsets.
const fullProjection=compileReviewedReadingRoleProfiles(
  PRACTICE_CATALOG,SYNTAX_PROFILES,manifest);
const scopes = [];
const pendingByScope = [];
for (const scope of ["all","tier1","tier2","tier3","tier4"] as const) {
  const tiers={tier1:1,tier2:2,tier3:3,tier4:4} as const;
  const data=scope==="all" ? whole
    : catalogsForCommonnessTiers(whole,COMMONNESS_TIER_THRESHOLDS,[tiers[scope]]);
  const ids=new Set(data.practice.map(e=>e.id));
  const rows=manifest.rows.filter(r=>ids.has(r.entryId));
  const projection=scope==="all" ? fullProjection
    : compileReviewedReadingRoleProfiles(
        data.practice,data.syntaxProfiles,{...manifest,rows});
  const blocked=staticallyAbstainedGroups(data.practice,data.syntaxProfiles);
  const covered=rows.filter(row=>blocked.has(JSON.stringify([row.word,row.upos])));
  const coveredKeys=new Set(covered.map(row=>JSON.stringify([row.word,row.upos])));
  const pending=[...blocked].filter(([key])=>!coveredKeys.has(key))
    .map(([,data])=>data)
    .sort((a,b)=>a.word.localeCompare(b.word,"zh-Hant")||a.upos.localeCompare(b.upos));
  pendingByScope.push({scope,unreviewedGroups:pending});
  scopes.push({
    scope,
    catalogEntries:data.practice.length,
    compiledSourceProfiles:data.syntaxProfiles.length,
    staticBlockedWordUposGroups:blocked.size,
    reviewedRoleRows:rows.length,
    reviewedRowsInStaticBlockedGroups:covered.length,
    staticBlockedGroupsWithoutReviewedRoleEvidence:blocked.size-covered.length,
    alreadyHasSourceRole:projection.report.existingRuntimeRoleRows,
    newSourceOnlyProfiles:projection.report.addedSourceRoleProfiles,
    byEntry:projection.report.rows,
    reportDigest:projection.report.determinismDigest,
  });
}
const report = {
  schemaVersion:"reviewed-reading-role-batch-audit-v1",
  purpose:"strict source-backed reading-role candidate coverage; not a natural-sentence pronunciation accuracy metric",
  manifestRows:manifest.rows.length,
  originalRuntimeProfiles:SYNTAX_PROFILES.length,
  addedProfiles:fullProjection.report.addedSourceRoleProfiles,
  scopes,
};
// --output additionally writes an exact review queue, not merely a group count.
// The queue is pending evidence work; never feed it into the production gate.
if(args.output!==null){
  await writeFile(args.output,JSON.stringify({...report,pendingByScope},null,2)+"\n","utf8");
}
console.log("READING_ROLE_BATCH_PIPELINE_JSON "+JSON.stringify(report));
