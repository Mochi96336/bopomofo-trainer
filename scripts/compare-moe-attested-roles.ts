import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import {
  isMoeAttestedRoleMismatch,
  MOE_ATTESTED_ROLE_RESTRICTIONS,
} from "../src/readings/moe-attested-role-compatibility.js";

interface Sentence {
  readonly seedIndex:number;
  readonly text:string|null;
  readonly root:string|null;
  readonly entryIds:readonly string[];
}
interface Hit {
  readonly seedIndex:number;
  readonly entryIndex:number;
  readonly selectedEntryId:string;
  readonly selectedUpos:string;
  readonly text:string;
}
interface Report {
  readonly readingEligibilityPolicy:string;
  readonly seedNamespace:string;
  readonly catalogEntryCount:number;
  readonly sampleCount:number;
  readonly failedSentences:number;
  readonly successfulSentences:number;
  readonly sentences:readonly Sentence[];
  readonly hits:readonly Hit[];
}

/** Actual shipped #446 final samples, with zero duplicate bad slots per seed. */
export const FROZEN_MOE_ROLE_BAD_SLOTS = [
  {seed:399,slot:1,id:catalogEntryId("數","ㄕㄨㄛ4")},
  {seed:431,slot:0,id:catalogEntryId("單","ㄕㄢ4")},
  {seed:471,slot:3,id:catalogEntryId("地","ㄉㄜ5")},
  {seed:507,slot:3,id:catalogEntryId("六","ㄌㄨ4")},
  {seed:597,slot:1,id:catalogEntryId("單","ㄔㄢ2")},
  {seed:929,slot:4,id:catalogEntryId("數","ㄕㄨㄛ4")},
  {seed:935,slot:0,id:catalogEntryId("單","ㄔㄢ2")},
  {seed:968,slot:3,id:catalogEntryId("數","ㄕㄨㄛ4")},
  {seed:998,slot:3,id:catalogEntryId("單","ㄕㄢ4")},
  {seed:1051,slot:0,id:catalogEntryId("單","ㄕㄢ4")},
  {seed:1259,slot:2,id:catalogEntryId("六","ㄌㄨ4")},
  {seed:1452,slot:4,id:catalogEntryId("數","ㄕㄨㄛ4")},
  {seed:1469,slot:0,id:catalogEntryId("單","ㄕㄢ4")},
  {seed:1740,slot:0,id:catalogEntryId("單","ㄔㄢ2")},
  {seed:1897,slot:1,id:catalogEntryId("六","ㄌㄨ4")},
  {seed:2011,slot:3,id:catalogEntryId("數","ㄕㄨㄛ4")},
] as const;
const badBySeed = new Map(FROZEN_MOE_ROLE_BAD_SLOTS.map(x=>[x.seed,x]));

function invalidRole(hit:Hit):boolean {
  return isMoeAttestedRoleMismatch(
    hit.selectedEntryId,
    hit.selectedUpos as Parameters<typeof isMoeAttestedRoleMismatch>[1],
  );
}

export function compareMoeAttestedRoles(before:Report,after:Report) {
  if (before.readingEligibilityPolicy!=="standard-na-surname-trial"
    || after.readingEligibilityPolicy!=="standard-role-evidence-trial"
    || before.seedNamespace!==after.seedNamespace
    || before.catalogEntryCount!==after.catalogEntryCount
    || before.sampleCount!==2048 || after.sampleCount!==2048
    || before.sentences.length!==2048 || after.sentences.length!==2048
    || before.failedSentences!==0 || after.failedSentences!==0
    || before.successfulSentences!==2048 || after.successfulSentences!==2048
    || !Array.isArray(before.hits) || !Array.isArray(after.hits)) {
    throw new Error("MOE role evidence comparison requires exact frozen #446 final 2048 seeds");
  }
  const badHits=before.hits.filter(invalidRole);
  const counts=new Map<string,number>();
  for(const hit of badHits) counts.set(hit.selectedEntryId,(counts.get(hit.selectedEntryId)??0)+1);
  const frozenHitShape=badHits.map(h=>({seed:h.seedIndex,slot:h.entryIndex,id:h.selectedEntryId}))
    .sort((a,b)=>a.seed-b.seed || a.slot-b.slot);
  if(badHits.length!==FROZEN_MOE_ROLE_BAD_SLOTS.length
    || JSON.stringify(frozenHitShape)!==JSON.stringify(FROZEN_MOE_ROLE_BAD_SLOTS)) {
    throw new Error("original MOE role-discrepant selected identities changed; re-review evidence");
  }
  if(after.hits.some(invalidRole)){
    throw new Error("final learner output retains a MOE-incompatible UPOS reading");
  }
  const changedSeeds:number[]=[];
  const changedDetails:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  for(let seed=0;seed<2048;seed++){
    const left=before.sentences[seed],right=after.sentences[seed];
    if(!left || !right || left.seedIndex!==seed || right.seedIndex!==seed
      || left.root!==right.root || left.entryIds.length!==right.entryIds.length){
      throw new Error("seed, syntax root or lexical length drift at "+seed);
    }
    const changed=left.entryIds.flatMap((id,slot)=>id===right.entryIds[slot]?[]:[slot]);
    if(changed.length===0 && left.text!==right.text)
      throw new Error("unexplained textual drift at seed "+seed);
    const originallyInvalid=badBySeed.get(seed);
    if(originallyInvalid===undefined){
      if(changed.length!==0)throw new Error("unrelated seed changed at "+seed);
      continue;
    }
    if(changed.length!==1 || changed[0]!==originallyInvalid.slot
       || left.entryIds[originallyInvalid.slot]!==originallyInvalid.id){
      throw new Error("unrepaired originally invalid slot or unrelated lexical slot changed at "+seed);
    }
    changedSeeds.push(seed);
    changedDetails.push({
      seedIndex:seed,
      slot:originallyInvalid.slot,
      priorId:originallyInvalid.id,
      newId:right.entryIds[originallyInvalid.slot]!,
    });
  }
  if(changedDetails.length!==16)throw new Error("unexpected number of role mismatch repairs");
  const knownGloballyUnsupported=[
    catalogEntryId("比","ㄅㄧ1"),
    catalogEntryId("了","ㄌㄧㄠ4"),
    catalogEntryId("得","ㄉㄜ4"),
    catalogEntryId("於","ㄩ1"),
    catalogEntryId("南","ㄋㄚ1"),
    catalogEntryId("行","ㄏㄥ2"),
    catalogEntryId("過","ㄍㄨㄛ5"),
  ];
  for(const s of after.sentences){
    if(s.entryIds.some(id=>knownGloballyUnsupported.includes(id))){
      throw new Error("final output includes a previously established unsupported ID at seed "+s.seedIndex);
    }
  }
  if(after.hits.some(hit=>hit.selectedEntryId===catalogEntryId("那","ㄋㄚ1")
    && (hit.selectedUpos==="PRON"||hit.selectedUpos==="ADV"))){
    throw new Error("previous surname-only Na violation reintroduced");
  }
  return {
    schemaVersion:"moe-attested-role-paired-diff-v1",
    sampleCount:2048,wrongRoleOccurrencesBefore:badHits.length,
    wrongRoleOccurrencesAfter:0,
    affectedIdentities:MOE_ATTESTED_ROLE_RESTRICTIONS.map(rule=>({
      entryId:rule.entryId,invalidUsesBefore:counts.get(rule.entryId)??0,
    })),
    badSeeds:FROZEN_MOE_ROLE_BAD_SLOTS.map(x=>x.seed),
    changedSeeds,
    changedOutsideOriginallyInvalidSlot:0,
    changedDetails,
    caveat:"These are exactly five MOE-attested role mismatches, not bans on rare legal readings or an estimate of all pronunciation errors.",
  };
}

if(process.argv[1]?.endsWith("compare-moe-attested-roles.ts")){
  const [beforePath,afterPath,outputPath]=process.argv.slice(2);
  if(!beforePath||!afterPath||!outputPath)
    throw new Error("usage: compare-moe-attested-roles <before.json> <after.json> <output.json>");
  const result=compareMoeAttestedRoles(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
