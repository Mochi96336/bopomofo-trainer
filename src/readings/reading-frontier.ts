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


/**
 * Exactly reviewed pronunciation × UPOS licenses for the EXISTING sentence
 * generator. Unlike FREE_ALTERNANTS, these do not assert interchangeability:
 * only that both existing catalog readings genuinely have this grammatical
 * category. The current generator explicitly does not validate semantic
 * combinations; it displays each selected catalog entry's target Zhuyin.
 *
 * Independent MOE Concised + Revised headword evidence (online cross-check):
 * 看 ㄎㄢ1 / ㄎㄢ4: both verbal; guarded/look.
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=18398
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=18436
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4531
 * 喝 ㄏㄜ1 / ㄏㄜ4: both verbal; drink/call.
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4731
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19194
 * 東西 ㄉㄨㄥ1-ㄒㄧ1 / ㄉㄨㄥ1-ㄒㄧ5: full-word nominal headwords.
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=48850
 *
 * September 2026 source-archive matched IDs and UPOS are distinct from
 * surface-keyed UD: the dictionary POS review is the independent license.
 * Do not add e.g. 女/PART or 說/PART based on inherited UD tags.
 */
export const REVIEWED_READING_ROLE_FRONTIERS = [
  {
    word: "看", upos: "VERB",
    readings: [catalogEntryId("看", "ㄎㄢ1"), catalogEntryId("看", "ㄎㄢ4")],
  },
  {
    word: "喝", upos: "VERB",
    readings: [catalogEntryId("喝", "ㄏㄜ1"), catalogEntryId("喝", "ㄏㄜ4")],
  },
  {
    word: "東西", upos: "NOUN",
    readings: [catalogEntryId("東西", "ㄉㄨㄥ1-ㄒㄧ1"), catalogEntryId("東西", "ㄉㄨㄥ1-ㄒㄧ5")],
  },
] as const;

const REVIEWED_ROLE_SETS = new Map<string, ReadonlySet<string>>();
for (const row of REVIEWED_READING_ROLE_FRONTIERS) {
  const key = row.word + "/" + row.upos;
  if (REVIEWED_ROLE_SETS.has(key) || new Set(row.readings).size !== row.readings.length
    || row.readings.length < 2) {
    throw new Error("invalid duplicate reviewed reading role: " + key);
  }
  REVIEWED_ROLE_SETS.set(key, new Set(row.readings));
}

/**
 * Same original real sentence frontier, expanded ONLY when the complete
 * per-slot written-form/UPOS identity set equals an explicitly source-reviewed
 * grammatical role. Never grant arbitrary dictionary readings a cloned UPOS.
 * Retains all unresolved-group exclusions and previous licensed free variants.
 */
export function allowReviewedRoleReadings(
  frontier: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
): readonly RuntimeSyntaxProfile[] {
  const original = excludeUnresolvedReadingGroups(frontier, entriesById);
  const originalProfiles = new Set(original);
  const idsByKey = new Map<string, Set<string>>();
  for (const profile of frontier) {
    const entry = entriesById.get(profile.entryId);
    if (entry === undefined) throw new Error("reviewed frontier references missing entry");
    const key = entry.prompt.text + "/" + profile.upos;
    const ids = idsByKey.get(key) ?? new Set<string>();
    ids.add(entry.id);
    idsByKey.set(key, ids);
  }
  const additionalKeys = new Set([...idsByKey].filter(([key, ids]) => {
    const approved = REVIEWED_ROLE_SETS.get(key);
    return approved !== undefined
      && approved.size === ids.size
      && [...ids].every(id => approved.has(id));
  }).map(([key]) => key));
  if (additionalKeys.size === 0) return original;
  return frontier.filter(profile => {
    if (originalProfiles.has(profile)) return true;
    const entry = entriesById.get(profile.entryId)!;
    return additionalKeys.has(entry.prompt.text + "/" + profile.upos);
  });
}
