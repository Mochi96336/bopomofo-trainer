import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "../src/core/model.js";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { REVIEWED_CLOSED_CLASS_POSITIONS } from "../src/readings/closed-class-license.js";
import {
  REVIEWED_PRONOMINAL_ROLE_READINGS, reviewedRoleReadingEligible,
} from "../src/readings/pronominal-role-license.js";
import type { RuntimeSyntaxProfile, Upos } from "../src/syntax/types.js";

export interface FrontierCatalog {
  readonly entries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
}
export interface FrontierInput {
  readonly word: string;
  readonly upos: Upos;
  readonly targetOffset: number;
}
export function inspectReadingProvenance(input: FrontierInput, catalog: FrontierCatalog) {
  const closedPositions = REVIEWED_CLOSED_CLASS_POSITIONS[input.word] ?? [];
  const pronominalPositions = REVIEWED_PRONOMINAL_ROLE_READINGS[input.word] ?? {};
  const gateIsReadingSpecific =
    closedPositions.includes(input.upos)
    || Object.prototype.hasOwnProperty.call(pronominalPositions,input.upos);
  const codePointCount = [...input.word].length;
  const candidates = catalog.entries.filter(e=>
    e.prompt.text===input.word && e.syllables.length===codePointCount);
  const profileMap = new Map<string,RuntimeSyntaxProfile[]>();
  for(const p of catalog.profiles){
    if(p.upos!==input.upos)continue;
    const existing=profileMap.get(p.entryId)??[];
    existing.push(p);
    profileMap.set(p.entryId,existing);
  }
  const entries = candidates.map(e=>{
    const profiles=profileMap.get(e.id)??[];
    return {
      id:e.id,
      readingTokens:e.syllables[input.targetOffset]?.tokens ?? null,
      alignedToSourceUpos:profiles.length>0,
      allowedByShippingGate:profiles.some(p=>reviewedRoleReadingEligible(e,p)),
      catalogProvenanceIds:e.provenanceIds,
      catalogTags:e.tags,
      matchingProfiles:profiles.map(p=>({
        profileId:p.id,upos:p.upos,
        eligible:reviewedRoleReadingEligible(e,p),
        functions:p.functions,
        valencyFrames:p.valencyFrames,
        provenanceIds:p.provenanceIds,
        dependencyRelationCounts:p.dependencyEvidence.dependencyRelationCounts,
      })),
    };
  });
  return {
    input,gateIsReadingSpecific,
    closedClassReviewedRoles:closedPositions,
    pronominalReviewedRoles:Object.keys(pronominalPositions),
    exactAlignedCatalogCount:entries.length,
    sameUposEntryCount:entries.filter(e=>e.alignedToSourceUpos).length,
    shippingLicensedEntryCount:entries.filter(e=>e.allowedByShippingGate).length,
    entries,
    note:gateIsReadingSpecific
      ? "At least one reviewed reading gate applies to this word+UPOS"
      : "No reading-specific reviewed role gate applies: surviving candidates are not proof of contextual disambiguation",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const output=process.argv[2]??"data/generated/attested-unresolved-catalog-provenance.json";
  const cases:readonly FrontierInput[]=[
    {word:"種",upos:"NOUN",targetOffset:0},
    {word:"給",upos:"VERB",targetOffset:0},
    {word:"給",upos:"ADP",targetOffset:0},
    {word:"種",upos:"VERB",targetOffset:0},
  ];
  const results=cases.map(input=>inspectReadingProvenance(input,{
    entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
  }));
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify({
    schemaVersion:"attested-word-upos-provenance-v1",
    warning:"Source UPOS is oracle metadata and there is no whole-sentence parser here",
    results,
  },null,2)+"\n","utf8");
  console.log(JSON.stringify(results.map(r=>({
    word:r.input.word,upos:r.input.upos,
    gateIsReadingSpecific:r.gateIsReadingSpecific,
    exactAlignedCatalogCount:r.exactAlignedCatalogCount,
    sameUposEntryCount:r.sameUposEntryCount,
    shippingLicensedEntryCount:r.shippingLicensedEntryCount,
    entries:r.entries.map(e=>({
      id:e.id,uposProfileCount:e.matchingProfiles.length,
      licensed:e.allowedByShippingGate,
      functions:e.matchingProfiles.flatMap(p=>p.functions),
      frames:e.matchingProfiles.flatMap(p=>p.valencyFrames),
    })),
  })),null,2));
}
