import type { CatalogEntry, Exercise } from "../core/model.js";

/**
 * A standalone guided key-typing exercise for an exact catalog pronunciation.
 * It is not a natural-language sentence or a recognition/recall question.
 * No semantic inference, UPOS projection or arbitrary sentence reading occurs.
 */
interface VerifiedTargetRow {
  readonly entryId: string;
  readonly word: string;
  readonly verifiedSourceIds: {
    readonly concised: string;
    readonly revised: string;
  };
  readonly activeUposesFromPendingConflict: readonly string[];
}
interface VerifiedTargetManifest {
  readonly schemaVersion: "tier1-source-verified-guided-lexeme-targets-v1";
  readonly sourceEdition: "20260929";
  readonly policy: string;
  readonly pendingWordUposGroups: number;
  readonly pendingReadingIdentities: number;
  readonly sourceMatchStatusCounts: Readonly<Record<string, number>>;
  readonly eligibleStandaloneGuidedReadings: number;
  readonly excludedForIncompleteSourceEvidence: number;
  readonly rows: readonly VerifiedTargetRow[];
  readonly excluded: readonly unknown[];
  readonly productionPolicyChanged: false;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(label+" must be an object");
  return value as Record<string, unknown>;
}
const SOURCE_ID=/^[0-9]+$/u;

export function prepareVerifiedGuidedLexemePractice(
  raw: unknown,
  catalog: readonly CatalogEntry[],
): {
  readonly eligibleEntryIds: readonly string[];
  readonly exerciseFor: (entryId: string, layoutId: string) => Exercise;
} {
  const manifest=object(raw,"verified guided lexeme source");
  if (manifest.schemaVersion!=="tier1-source-verified-guided-lexeme-targets-v1"
    || manifest.sourceEdition!=="20260929"
    || manifest.productionPolicyChanged!==false
    || !Array.isArray(manifest.rows)
    || !Array.isArray(manifest.excluded)
    || manifest.eligibleStandaloneGuidedReadings!==manifest.rows.length
    || typeof manifest.pendingReadingIdentities!=="number"
    || manifest.pendingReadingIdentities!==manifest.rows.length+manifest.excluded.length)
    throw new Error("unverified or changed guided lexeme source manifest");
  const indexed=new Map(catalog.map(e=>[e.id,e]));
  if(indexed.size!==catalog.length)throw new Error("duplicate practice catalog entries");
  const targets=new Map<string,CatalogEntry>();
  for(const entry of manifest.rows){
    const item=object(entry,"verified target");
    const pins=object(item.verifiedSourceIds,"target official source pins");
    if(typeof item.entryId!=="string" || typeof item.word!=="string"
      || typeof pins.concised!=="string" || !SOURCE_ID.test(pins.concised)
      || typeof pins.revised!=="string" || !SOURCE_ID.test(pins.revised)
      || !Array.isArray(item.activeUposesFromPendingConflict)
      || item.activeUposesFromPendingConflict.length===0)
      throw new Error("invalid full-word reading evidence row");
    if(targets.has(item.entryId))throw new Error("duplicated reviewed target ID");
    const catalogEntry=indexed.get(item.entryId);
    if(catalogEntry===undefined || catalogEntry.prompt.text!==item.word
      || catalogEntry.syllables.length===0)
      throw new Error("reviewed guided reading not present as whole catalog entry");
    targets.set(item.entryId,catalogEntry);
  }
  const eligibleEntryIds=[...targets.keys()].sort();
  return {
    eligibleEntryIds,
    exerciseFor:(entryId,layoutId)=>{
      const entry=targets.get(entryId);
      if(entry===undefined)throw new Error("unreviewed or not source-pinned reading target: "+entryId);
      if(!layoutId)throw new Error("layout ID is required");
      return {
        id:"guided-exact-reading:"+entryId,
        mode:"guided",layoutId,entries:[entry],
      };
    },
  };
}
