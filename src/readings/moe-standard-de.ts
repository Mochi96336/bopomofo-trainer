import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

export const NONSTANDARD_DE_FOURTH_TONE_ID = catalogEntryId("得", "ㄉㄜ4");

/** Exact-identity check for an unsupported standalone 得 reading. */
export function reviewedMoeStandardDeReadingEligible(entry: CatalogEntry, profile: RuntimeSyntaxProfile): boolean {
  if (entry.id !== profile.entryId) throw new Error("reading identity and profile mismatch");
  return entry.id !== NONSTANDARD_DE_FOURTH_TONE_ID;
}
