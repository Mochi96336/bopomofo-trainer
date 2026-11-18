import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  PRODUCT_READING_POLICY, productReadingEligibleWithoutPreviousEntry,
} from "../src/readings/product-reading-policy.js";
import {
  CONSTRUCTION_READINGS, lexicalConstructionFeatureMatches,
  supportsLexicalConstructionFeature,
} from "../src/syntax/lexical-feature-match.js";
import { parseReviewedReadingRoleManifest } from "../src/readings/attested-reading-role-profiles.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { RuntimeSyntaxProfile, SyntaxFeatureName } from "../src/syntax/types.js";

/**
 * Fully automatic, read-only sweep of every blocked word+UPOS source group.
 * Three different evidence statuses are intentionally NOT collapsed:
 *   - source-confirmed word/reading headword (MOE bulk dictionary);
 *   - an independently reviewed, exact construction license already in code;
 *   - still requiring per-reading syntactic evidence.
 *
 * Dictionary listing alone NEVER proves a reading for a generated syntactic
 * context. A unique available headword reading is not a 'default reading'.
 * No guessed sense, semantics, G2P or made-up UD pronunciation is permitted.
 *
 * npx tsx scripts/audit-bulk-polyphone-reading-evidence.ts --output /tmp/bulk-review.json
 */
const FEATURE_CANDIDATES: readonly (readonly [SyntaxFeatureName,string])[] = [
  ["polarity","negative"],
  ["aspect","marked"],
  ["voice","disposal"],["voice","passive"],["voice","causative"],
  ["questionType","polar"],["questionType","constituent"],["questionType","alternative"],
  ["questionType","a-not-a"],
  ["clauseType","existential"],["clauseType","comparative"],["clauseType","relational-ccomp"],
  ["clauseType","request"],["clauseType","relative"],["clauseType","nominalized"],
  ["complementType","directional"],["complementType","potential"],["complementType","degree"],
  ["coordinationType","coordination"],["coordinationType","additive"],
  ["coordinationType","alternative"],["coordinationType","cause-result"],
  ["coordinationType","condition"],["coordinationType","hypothetical"],
  ["coordinationType","concessive"],["coordinationType","contrast"],
  ["coordinationType","purpose"],["coordinationType","temporal-sequence"],
];

interface SourceRow {
  readonly lookupText: string;
  readonly trainerReading: string;
  readonly sourceEntryId: string;
}
interface SourceData {
  readonly adapterVersion: string;
  readonly rows: readonly SourceRow[];
}
const sourcePath=new URL("../data/readings/moe-concised-2014_20260626-active-catalog.json",import.meta.url);
const reviewedPath=new URL("../data/readings/reviewed-reading-role-evidence.json",import.meta.url);
const source=JSON.parse(readFileSync(sourcePath,"utf8")) as SourceData;
if(source.adapterVersion!=="moe-concised-reading-adapter-v1"||!Array.isArray(source.rows))
  throw new Error("unknown MOE headword source schema");
const reviewed=parseReviewedReadingRoleManifest(
  JSON.parse(readFileSync(reviewedPath,"utf8")) as unknown);
const byOfficialIdentity=new Map<string,string[]>();
for(const row of source.rows){
  if(!row.lookupText || !row.trainerReading || !row.sourceEntryId)continue;
  const identity=catalogEntryId(row.lookupText,row.trainerReading.trim().replace(/\s+/gu,"-"));
  byOfficialIdentity.set(identity,[...(byOfficialIdentity.get(identity)??[]),row.sourceEntryId]);
}
const positiveRoleByGroup=new Map(
  reviewed.rows.map(row=>[JSON.stringify([row.word,row.upos]),row.entryId]),
);
const filteredFeatureCandidates=FEATURE_CANDIDATES.filter(([f,v])=>
  supportsLexicalConstructionFeature(f,v));

function allBlocked(entries:readonly CatalogEntry[],profiles:readonly RuntimeSyntaxProfile[]){
  const entryById=new Map(entries.map(e=>[e.id,e]));
  const groups=new Map<string,RuntimeSyntaxProfile[]>();
  for(const p of profiles){
    const entry=entryById.get(p.entryId);
    if(!entry||!productReadingEligibleWithoutPreviousEntry(entry,p))continue;
    const key=JSON.stringify([entry.prompt.text,p.upos]);
    groups.set(key,[...(groups.get(key)??[]),p]);
  }
  return [...groups].filter(([,ps])=>
    new Set(ps.map(p=>p.entryId)).size>1
    &&PRODUCT_READING_POLICY.readingFrontierFilter(ps,entryById).length===0);
}

function triage(label:string,entries:readonly CatalogEntry[],profiles:readonly RuntimeSyntaxProfile[]){
  const entryById=new Map(entries.map(e=>[e.id,e]));
  const groups=allBlocked(entries,profiles);
  const rows=groups.map(([key,ps])=>{
    const [word,upos]=JSON.parse(key) as [string,string];
    const readingEntryIds=[...new Set(ps.map(p=>p.entryId))].sort();
    const attested=readingEntryIds
      .filter(id=>byOfficialIdentity.has(id))
      .map(id=>({entryId:id,moeSourceEntryIds:byOfficialIdentity.get(id)!}));
    const constructionEvidence=[];
    // Source features are reviewed by lexical-feature-match.ts and explicitly
    // gated against reading IDs; unique only if exactly one conflicting identity
    // is compatible with THIS exact construction and source profile.
    for(const [feature,value] of filteredFeatureCandidates){
      const matched=[...new Set(ps.filter(p=>
        lexicalConstructionFeatureMatches(
          p.entryId,word,p,feature,value
        )).map(p=>p.entryId))];
      const allowed=CONSTRUCTION_READINGS[word]??[];
      const authorized=matched.filter(id=>allowed.some(reading=>
        id===catalogEntryId(word,reading)));
      if(authorized.length!==1||matched.length!==1)continue;
      constructionEvidence.push({feature,value,entryId:authorized[0]!});
    }
    const reviewedEntryId=positiveRoleByGroup.get(key)??null;
    const status=reviewedEntryId!==null?"already-reviewed-role-record"
      :constructionEvidence.length>0?"existing-identity-gated-construction-to-evaluate"
      :attested.length===readingEntryIds.length?"all-readings-in-MOE-still-syntax-ambiguous"
      :attested.length>0?"partly-in-MOE-still-syntax-ambiguous"
      :"no-exact-MOE-concised-headword-coverage";
    const hasSourceOnly=attested.length===1&&readingEntryIds.length>1;
    return {
      word,upos,status,readingEntryIds,
      officialHeadwordReadingEvidence:attested,
      existingIdentityGatedConstructions:constructionEvidence,
      reviewedEntryId,
      note:hasSourceOnly
        ?"Only one candidate is present in MOE Concised: absence of alternatives is NOT a license to exclude them"
        :"Word/reading headword citation never establishes reading of a generated sentence",
    };
  }).sort((a,b)=>a.word.localeCompare(b.word,"zh-Hant")||a.upos.localeCompare(b.upos));
  const byStatus:Record<string,number>={};
  for(const row of rows)byStatus[row.status]=(byStatus[row.status]??0)+1;
  return {
    scope:label,
    blockedWordUposGroups:rows.length,
    byStatus:Object.fromEntries(Object.entries(byStatus).sort()),
    existingSourceSpecificConstructionCandidateGroups:rows.filter(r=>
      r.existingIdentityGatedConstructions.length>0).length,
    dictionaryHeadwordCoverage:rows.filter(r=>
      r.officialHeadwordReadingEvidence.length>0).length,
    dictionaryCorroboratesAllConflictingReadings:rows.filter(r=>
      r.officialHeadwordReadingEvidence.length===r.readingEntryIds.length).length,
    rows,
  };
}
const args=process.argv.slice(2);
if(args.length!==0&&!(args.length===2&&args[0]==="--output"&&args[1]))
  throw new Error("usage: tsx scripts/audit-bulk-polyphone-reading-evidence.ts [--output path.json]");
const whole={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const tier1=catalogsForCommonnessTiers(whole,COMMONNESS_TIER_THRESHOLDS,[1]);
const report={
  version:"bulk-syntax-evidence-triage-v1",
  basis:"compiled active catalog, frozen official MOE Concised headword rows, and reviewed lexical construction identity gates",
  safety:"research queue only. No word/reading-only fallback, no changing reading policy, no automatic gold labels.",
  full:triage("all",whole.practice,whole.syntaxProfiles),
  tier1:triage("tier1",tier1.practice,tier1.syntaxProfiles),
};
if(args.length>0)writeFileSync(resolve(args[1]!),JSON.stringify(report,null,2)+"\n","utf8");
const compact=(scope:typeof report.full)=>({
  scope:scope.scope,blocked:scope.blockedWordUposGroups,
  byStatus:scope.byStatus,constructionCandidates:scope.existingSourceSpecificConstructionCandidateGroups,
  headwordEvidence:scope.dictionaryHeadwordCoverage,
  headwordAllReadings:scope.dictionaryCorroboratesAllConflictingReadings,
  constructionExamples:scope.rows.filter(x=>x.existingIdentityGatedConstructions.length>0)
    .map(x=>({word:x.word,upos:x.upos,constructions:x.existingIdentityGatedConstructions})).slice(0,25),
});
console.log("BULK_SYNTAX_EVIDENCE_TRIAGE_JSON "+JSON.stringify({
  full:compact(report.full),tier1:compact(report.tier1),
}));
