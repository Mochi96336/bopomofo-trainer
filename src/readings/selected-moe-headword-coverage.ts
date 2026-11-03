/**
 * Evidence inventory for *actually selected*, final, 2,048-seed practice entries.
 *
 * The generated MOE Concised projection is an intentionally selective,
 * single-reading catalog adapter; Revised is an explicitly provisional
 * fallback subset. Neither file is an exhaustive list of valid heteronyms.
 * A different or missing projection is a REVIEW QUEUE ITEM, NEVER proof of
 * a wrong pronunciation and NEVER permission to reject an entry.
 */
export const SELECTED_MOE_COVERAGE_SCHEMA_VERSION = "selected-moe-headword-coverage-v1";

export type ProjectionStatus =
  | "matches-concised-projection"
  | "differs-from-concised-projection"
  | "matches-revised-fallback-projection"
  | "differs-from-revised-fallback-projection"
  | "not-in-exact-headword-projections";

type Source = "moe-concised" | "moe-revised-provisional";

export interface SelectedSentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly root: string | null;
  readonly entryIds: readonly string[];
}
export interface SelectedExposureReport {
  readonly schemaVersion: string;
  readonly readingEligibilityPolicy: string;
  readonly sampleCount: number;
  readonly catalogEntryCount: number;
  readonly successfulSentences: number;
  readonly failedSentences: number;
  readonly sentences: readonly SelectedSentence[];
}
export interface ProjectionRow {
  readonly lookupText: string;
  readonly trainerReading: string;
  readonly sourceEntryId: string;
  readonly fallbackStatus?: string;
}
export interface Projection {
  readonly adapterVersion: string;
  readonly rows: readonly ProjectionRow[];
}
export interface SelectedIdentityCoverage {
  readonly entryId: string;
  readonly text: string;
  readonly reading: string;
  readonly occurrences: number;
  readonly seedIndices: readonly number[];
  readonly selectedExamples: readonly {seedIndex:number; lexicalSlot:number; sentence:string|null}[];
  readonly status: ProjectionStatus;
  readonly projection: { source: Source; reading:string; sourceEntryId:string } | null;
  /** True means 'requires human comparison with full MOE references', NOT 'wrong'. */
  readonly needsReferenceReview: boolean;
}

function nonEmpty(value:unknown, label:string): string {
  if(typeof value !== "string" || !value.trim()) throw new Error(label+" must be a nonempty string");
  return value.trim().normalize("NFC");
}
function normalizeTrainerReading(value:unknown):string {
  return nonEmpty(value,"projected reading").split(/\s+/u).join("-");
}
function selectedIdentity(entryId:string): {text:string;reading:string} {
  if(!entryId.startsWith("word:"))throw new Error("unexpected selected entry identity: "+entryId);
  const remaining=entryId.slice(5);
  const split=remaining.lastIndexOf(":");
  if(split<1 || split===remaining.length-1)throw new Error("malformed selected entry identity: "+entryId);
  return {text:remaining.slice(0,split).normalize("NFC"), reading:remaining.slice(split+1).normalize("NFC")};
}
function readProjection(value:Projection, source:Source, adapterVersion:string):
  ReadonlyMap<string,{reading:string;sourceEntryId:string;source:Source}> {
  if(value.adapterVersion!==adapterVersion || !Array.isArray(value.rows)){
    throw new Error("unsupported "+source+" projection schema");
  }
  const map=new Map<string,{reading:string;sourceEntryId:string;source:Source}>();
  for(const row of value.rows){
    const text=nonEmpty(row.lookupText,source+" lookup text");
    const sourceEntryId=nonEmpty(row.sourceEntryId,source+" source entry");
    const reading=normalizeTrainerReading(row.trainerReading);
    if(source==="moe-revised-provisional" && row.fallbackStatus!=="provisional"){
      throw new Error("revised fallback must be explicitly provisional");
    }
    if(map.has(text)) throw new Error("ambiguous exact-headword projection: "+text);
    map.set(text,{reading,sourceEntryId,source});
  }
  return map;
}

export function buildSelectedMoeHeadwordCoverage(
  audit:SelectedExposureReport,
  concised:Projection,
  revised:Projection,
) {
  if(audit.schemaVersion!=="polyphonic-context-exposure-v1"
    || audit.readingEligibilityPolicy!=="standard-role-followup-trial"
    || audit.sampleCount!==2048 || audit.sentences.length!==2048
    || audit.failedSentences!==0 || audit.successfulSentences!==2048
    || !Number.isSafeInteger(audit.catalogEntryCount) || audit.catalogEntryCount<=0){
    throw new Error("coverage requires the successful exact 2048-seed final 行 policy audit");
  }
  const conciseMap=readProjection(concised,"moe-concised","moe-concised-reading-adapter-v1");
  const revisedMap=readProjection(revised,"moe-revised-provisional","moe-revised-reading-fallback-adapter-v1");
  for(const text of revisedMap.keys()){
    if(conciseMap.has(text))throw new Error("overlapping source projections: "+text);
  }
  const selected=new Map<string,{text:string;reading:string;count:number;seeds:Set<number>;
    examples:{seedIndex:number;lexicalSlot:number;sentence:string|null}[]}>();
  let occurrenceTotal=0;
  for(let i=0;i<2048;i++){
    const sentence=audit.sentences[i];
    if(sentence?.seedIndex!==i || !Array.isArray(sentence.entryIds)
      || sentence.entryIds.length===0
      || (sentence.text!==null && typeof sentence.text!=="string")){
      throw new Error("missing or unaligned final delivered sentence at seed "+i);
    }
    for(let slot=0;slot<sentence.entryIds.length;slot++){
      const entryId=sentence.entryIds[slot]!;
      const {text,reading}=selectedIdentity(entryId);
      const prev=selected.get(entryId)??{text,reading,count:0,seeds:new Set<number>(),
        examples:[]};
      if(prev.text!==text || prev.reading!==reading)throw new Error("entry identity collision");
      prev.count++;
      prev.seeds.add(i);
      if(prev.examples.length<3)prev.examples.push({seedIndex:i,lexicalSlot:slot,sentence:sentence.text});
      selected.set(entryId,prev);
      occurrenceTotal++;
    }
  }
  const all:SelectedIdentityCoverage[]=[];
  for(const [entryId,value] of selected){
    const source=conciseMap.get(value.text)??revisedMap.get(value.text)??null;
    const same=source!==null && source.reading===value.reading;
    const status:ProjectionStatus=source===null
      ? "not-in-exact-headword-projections"
      : source.source==="moe-concised"
        ? (same?"matches-concised-projection":"differs-from-concised-projection")
        : (same?"matches-revised-fallback-projection":"differs-from-revised-fallback-projection");
    all.push({
      entryId,text:value.text,reading:value.reading,occurrences:value.count,
      seedIndices:[...value.seeds].sort((a,b)=>a-b),
      selectedExamples:value.examples,
      status,
      projection:source,
      needsReferenceReview:!same,
    });
  }
  // Stable, evidence-first priority. Higher-exposure entries first; never
  // infer reading incorrectness from absence or mismatch of the projection.
  const rank=(s:ProjectionStatus)=>s.startsWith("differs-")?0:s==="not-in-exact-headword-projections"?1:2;
  all.sort((a,b)=>rank(a.status)-rank(b.status)
    || b.occurrences-a.occurrences
    || a.entryId.localeCompare(b.entryId,"en"));
  const countByStatus:Record<ProjectionStatus,number>={
    "matches-concised-projection":0,
    "differs-from-concised-projection":0,
    "matches-revised-fallback-projection":0,
    "differs-from-revised-fallback-projection":0,
    "not-in-exact-headword-projections":0,
  };
  const occurrencesByStatus={...countByStatus};
  for(const item of all){
    countByStatus[item.status]++;
    occurrencesByStatus[item.status]+=item.occurrences;
  }
  return {
    schemaVersion:SELECTED_MOE_COVERAGE_SCHEMA_VERSION,
    sourcePolicy:audit.readingEligibilityPolicy,
    sampleCount:2048,
    successfulSentences:2048,
    totalSelectedOccurrences:occurrenceTotal,
    uniqueSelectedIdentities:all.length,
    countByStatus,occurrencesByStatus,
    reviewedAsIncorrectCount:0,
    caveat:"Coverage differences and missing projection rows are review leads, never proof of invalid pronunciation. Concised projection is selective; Revised fallback is provisional. Read full MOE headwords before any exclusion.",
    identities:all,
  };
}
