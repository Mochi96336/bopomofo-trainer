import { excludeUnresolvedReadingGroups } from "./reading-frontier.js";
import type { CatalogEntry, PracticeMode } from "../core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";

/**
 * A reviewed *typing target*, not a free variant or a reading assignment
 * for a natural sentence. The generated context can be semantically odd:
 * the purpose of this opt-in research path is to practice an explicitly
 * visible Bopomofo target under a licensed grammatical UPOS.
 */
interface OfficialReading {
  readonly entryId: string;
  readonly concisedSourceId: string;
  readonly revisedSourceId: string;
}
interface GuidedGroup {
  readonly word: string;
  readonly upos: "VERB" | "NOUN";
  readonly reviewedRole: "verb" | "nominal";
  readonly officialPage: string;
  readonly readings: readonly OfficialReading[];
}
export interface GuidedTypingManifest {
  readonly schemaVersion: "reviewed-guided-typing-readings-v1";
  readonly sourceEdition: "20260929";
  readonly purpose: string;
  readonly groups: readonly GuidedGroup[];
}

type Frontier = (
  profiles: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
) => readonly RuntimeSyntaxProfile[];

const officialPage = /^https:\/\/dict\.revised\.moe\.edu\.tw\/dictView\.jsp\?ID=[0-9]+$/u;
const sourceId = /^[0-9]+$/u;
const entryReading = /^[\u3105-\u3129]+[1-5](?:-[\u3105-\u3129]+[1-5])*$/u;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(label + " must be an object");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, permitted: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...permitted].sort()))
    throw new Error(label + ": unexpected or missing field");
}
function groupKey(word: string, upos: string): string {
  return JSON.stringify([word, upos]);
}
function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every(id => right.has(id));
}

export function parseGuidedTypingManifest(value: unknown): GuidedTypingManifest {
  const manifest = object(value, "guided typing manifest");
  keys(manifest, ["schemaVersion", "sourceEdition", "purpose", "groups"], "manifest");
  if (manifest.schemaVersion !== "reviewed-guided-typing-readings-v1"
    || manifest.sourceEdition !== "20260929"
    || typeof manifest.purpose !== "string" || !manifest.purpose
    || !Array.isArray(manifest.groups) || manifest.groups.length === 0)
    throw new Error("invalid guided typing manifest header");
  const seen = new Set<string>();
  const groups: GuidedGroup[] = [];
  for (const value of manifest.groups) {
    const raw = object(value, "guided group");
    keys(raw, ["word", "upos", "readings", "reviewedRole", "officialPage"], "group");
    if (typeof raw.word !== "string" || !raw.word
      || !(raw.upos === "VERB" && raw.reviewedRole === "verb"
        || raw.upos === "NOUN" && raw.reviewedRole === "nominal")
      || typeof raw.officialPage !== "string" || !officialPage.test(raw.officialPage)
      || !Array.isArray(raw.readings) || raw.readings.length < 2)
      throw new Error("unsupported or unreviewed guided role/word");
    const key = groupKey(raw.word, raw.upos);
    if (seen.has(key)) throw new Error("duplicate guided reading group");
    seen.add(key);
    const readings: OfficialReading[] = [];
    const identities = new Set<string>();
    for (const item of raw.readings) {
      const row = object(item, "guided reading");
      keys(row, ["entryId", "concisedSourceId", "revisedSourceId"], "reading");
      const prefix = "word:" + raw.word + ":";
      if (typeof row.entryId !== "string" || !row.entryId.startsWith(prefix)
        || !entryReading.test(row.entryId.slice(prefix.length))
        || typeof row.concisedSourceId !== "string" || !sourceId.test(row.concisedSourceId)
        || typeof row.revisedSourceId !== "string" || !sourceId.test(row.revisedSourceId))
        throw new Error("missing or malformed exact official reading evidence");
      if (identities.has(row.entryId)) throw new Error("duplicate reading identity");
      identities.add(row.entryId);
      readings.push({
        entryId: row.entryId,
        concisedSourceId: row.concisedSourceId,
        revisedSourceId: row.revisedSourceId,
      });
    }
    groups.push({
      word: raw.word, upos: raw.upos as Upos as GuidedGroup["upos"],
      reviewedRole: raw.reviewedRole as GuidedGroup["reviewedRole"],
      officialPage: raw.officialPage, readings,
    });
  }
  return {
    schemaVersion: "reviewed-guided-typing-readings-v1",
    sourceEdition: "20260929",
    purpose: manifest.purpose,
    groups: groups.sort((a,b)=>groupKey(a.word,a.upos).localeCompare(groupKey(b.word,b.upos),"zh-Hant")),
  };
}

/** Explicitly scoped opt-in; production continues using conservative abstention. */
export function compileGuidedTypingFrontier(
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  raw: unknown,
): {
  readonly licensedWordUposGroups: readonly string[];
  readonly filterForMode: (mode: PracticeMode) => Frontier;
} {
  const manifest = parseGuidedTypingManifest(raw);
  const byEntryId = new Map(entries.map(e=>[e.id,e]));
  if (byEntryId.size !== entries.length) throw new Error("duplicate catalog entry");
  const seenProfileIds = new Set<string>();
  const actualByGroup = new Map<string, Set<string>>();
  for (const profile of profiles) {
    if (seenProfileIds.has(profile.id) || !byEntryId.has(profile.entryId))
      throw new Error("missing profile catalog identity or duplicated profile");
    seenProfileIds.add(profile.id);
    const word = byEntryId.get(profile.entryId)!.prompt.text;
    const key = groupKey(word,profile.upos);
    const ids = actualByGroup.get(key) ?? new Set<string>();
    ids.add(profile.entryId);
    actualByGroup.set(key,ids);
  }
  const reviewedGroups = new Map<string, ReadonlySet<string>>();
  for (const group of manifest.groups) {
    const key = groupKey(group.word,group.upos);
    const approved = new Set(group.readings.map(r=>r.entryId));
    const actual = actualByGroup.get(key);
    if (actual === undefined || !sameSet(approved,actual)) {
      throw new Error("reviewed group does not exactly match active catalog and UPOS: " + key);
    }
    for (const id of approved) {
      if (byEntryId.get(id)?.prompt.text !== group.word)
        throw new Error("reviewed reading not in active catalog: " + id);
    }
    reviewedGroups.set(key,approved);
  }
  const guided:Frontier = (frontier,entriesById) => {
    const baseline = new Set(excludeUnresolvedReadingGroups(frontier,entriesById));
    const candidateGroups = new Map<string, Set<string>>();
    for (const p of frontier) {
      const e = entriesById.get(p.entryId);
      if (e === undefined) throw new Error("unknown selected catalog identity");
      const key = groupKey(e.prompt.text,p.upos);
      const ids = candidateGroups.get(key)??new Set<string>();
      ids.add(p.entryId);
      candidateGroups.set(key,ids);
    }
    const approvedGroups = new Set([...candidateGroups].filter(([key,ids])=>{
      const approved = reviewedGroups.get(key);
      // A third/changed candidate must not silently join an approved pair.
      return approved !== undefined && sameSet(ids,approved);
    }).map(([key])=>key));
    return frontier.filter(p => {
      if (baseline.has(p))return true;
      const e = entriesById.get(p.entryId)!;
      const key = groupKey(e.prompt.text,p.upos);
      return approvedGroups.has(key) && reviewedGroups.get(key)!.has(p.entryId);
    });
  };
  return {
    licensedWordUposGroups:[...reviewedGroups.keys()].sort(),
    filterForMode:(mode:PracticeMode) =>
      mode==="guided" ? guided : excludeUnresolvedReadingGroups,
  };
}
