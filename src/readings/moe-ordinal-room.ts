import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Source-attested local pronunciation: 第N + 間 as a count of rooms is jiān.
 * MOE Revised: ㄐㄧㄢ1 denotes the building/room classifier, whereas
 * ㄐㄧㄢ4 denotes spaces, informants and other unrelated meanings.
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=5765
 *
 * Only the exact *adjacent selected lexical entries* are checked. This
 * independent, late final-candidate policy preserves earlier reading gates,
 * catalog identities, selection weights, and legitimate non-ordinal jiàn.
 * No inference from aggregate profile.functions or sentence naturalness.
 */
const ORDINAL_WORD = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;
const ROOM_CLASSIFIER_READING = catalogEntryId("間", "ㄐㄧㄢ1");

export function reviewedMoeOrdinalRoomReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  _slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  if(entry.id !== profile.entryId) {
    throw new Error("ordinal-room policy must inspect the actual selected lexical identity");
  }
  if(entry.prompt.text !== "間"
    || profile.upos !== "NOUN"
    || previousEntry === null
    || !ORDINAL_WORD.test(previousEntry.prompt.text)) {
    return true;
  }
  return entry.id === ROOM_CLASSIFIER_READING;
}
