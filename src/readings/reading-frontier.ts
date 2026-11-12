import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/** Explicitly reviewed interchangeable readings, not all dictionary readings.
 * 哪/PRON: pronominal-role-license.ts, MOE Revised ID 2931.
 * 和/CCONJ: han-coordination-license.ts, MOE Concised IDs 19725/19016,
 * Revised ID 4733; ordinary hé and spoken hàn conjunction use.
 * Existing per-profile/context gates must run before this frontier policy.
 */
const FREE_ALTERNANTS = new Map<string, ReadonlySet<string>>([
  ["哪/PRON", new Set([catalogEntryId("哪", "ㄋㄚ3"), catalogEntryId("哪", "ㄋㄟ3")])],
  ["和/CCONJ", new Set([catalogEntryId("和", "ㄏㄜ2"), catalogEntryId("和", "ㄏㄢ4")])],
]);

export const READING_ABSTENTION_POLICY = {
  version: "unresolved-slot-reading-abstention-v1",
  scope: "licensed-written-form-upos-within-slot",
  unresolved: "exclude-entire-group",
} as const;

/** Inspect the complete licensed slot frontier BEFORE identity binding, used-word
 * exclusion and learner weighting. A zero weight or a previously drawn reading
 * cannot turn an unresolved group into a certified singleton. This preserves
 * catalog identities and learner history; only sentence selection abstains.
 */
export function excludeUnresolvedReadingGroups(
  frontier: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
): readonly RuntimeSyntaxProfile[] {
  const idsByGroup = new Map<string, Set<string>>();
  const keyFor = (profile: RuntimeSyntaxProfile): string => {
    const entry = entriesById.get(profile.entryId);
    if (entry === undefined) throw new Error("reading frontier references missing entry");
    return `${entry.prompt.text}/${profile.upos}`;
  };
  for (const profile of frontier) {
    const key = keyFor(profile);
    const ids = idsByGroup.get(key) ?? new Set<string>();
    ids.add(profile.entryId);
    idsByGroup.set(key, ids);
  }
  const unresolved = new Set([...idsByGroup].filter(([key, ids]) =>
    ids.size > 1 && ![...ids].every(id => FREE_ALTERNANTS.get(key)?.has(id) === true),
  ).map(([key]) => key));
  return unresolved.size === 0 ? frontier : frontier.filter(profile => !unresolved.has(keyFor(profile)));
}
