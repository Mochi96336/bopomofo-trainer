import type { CatalogEntry, RandomSource } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

interface ReadingGroup {
  readonly entryId: string;
  readonly profiles: readonly RuntimeSyntaxProfile[];
}

const frontierCache = new WeakMap<readonly RuntimeSyntaxProfile[], readonly ReadingGroup[]>();

function readingGroups(frontier: readonly RuntimeSyntaxProfile[]): readonly ReadingGroup[] {
  const cached = frontierCache.get(frontier);
  if (cached !== undefined) return cached;
  const byEntry = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of frontier) {
    const profiles = byEntry.get(profile.entryId) ?? [];
    profiles.push(profile);
    byEntry.set(profile.entryId, profiles);
  }
  const groups = [...byEntry].map(([entryId, profiles]) => ({ entryId, profiles }));
  frontierCache.set(frontier, groups);
  return groups;
}

interface TextTicket {
  readonly identity: string;
  readonly readings: readonly { group: ReadingGroup; weight: number }[];
  readonly weight: number;
  readonly readingWeight: number;
}
const staticTickets = new WeakMap<readonly RuntimeSyntaxProfile[], WeakMap<object, Map<string, readonly TextTicket[]>>>();

function unit(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("RandomSource.next() must return a finite value in [0, 1)");
  }
  return value;
}

/**
 * A written form owns one ticket, regardless of its number of readings/profiles.
 * Its ticket weight is the expectation of reading weights under the declared
 * uniform licensed-reading training prior. Conditional reading weights divide
 * the ticket. Thus the joint slot mass is proportional to F(text) * prior(reading)
 * * learnerBoost(reading), rather than an unrelated maximum aggregation.
 * The residual of the text draw is uniform inside its interval and can select
 * the reading without an extra RNG draw. This also preserves the one-reading
 * path's draw count. All legality filters must precede this function.
 */
export function selectLexicalProfile(input: {
  readonly frontier: readonly RuntimeSyntaxProfile[];
  readonly usedEntryIds: ReadonlySet<string>;
  readonly reusableEntryId: string | undefined;
  readonly entriesById: ReadonlyMap<string, CatalogEntry>;
  readonly weight: (entry: CatalogEntry) => number;
  readonly random: RandomSource;
  readonly sampling: "written-form" | "reading-identity";
  /** Only provided when weight depends exclusively on the immutable catalog. */
  readonly staticWeightKey?: object;
}): RuntimeSyntaxProfile | null {
  const usedTexts = new Set<string>();
  for (const id of input.usedEntryIds) {
    if (id !== input.reusableEntryId) {
      const entry = input.entriesById.get(id);
      if (entry !== undefined) usedTexts.add(entry.prompt.text);
    }
  }
  let tickets: readonly TextTicket[] | undefined;
  if (input.staticWeightKey !== undefined) {
    tickets = staticTickets.get(input.frontier)?.get(input.staticWeightKey)?.get(input.sampling);
  }
  if (tickets === undefined) {
    const texts = new Map<string, { identity: string; readings: { group: ReadingGroup; weight: number }[]; weight: number; readingWeight: number }>();
    for (const group of readingGroups(input.frontier)) {
      const entry = input.entriesById.get(group.entryId);
      if (entry === undefined) throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
      const weight = input.weight(entry);
      if (!Number.isFinite(weight) || weight < 0) throw new RangeError("formal syntax entry weights must be finite and non-negative");
      if (weight === 0) continue;
      const identity = input.sampling === "written-form" ? entry.prompt.text : entry.id;
      const text = texts.get(identity) ?? { identity, readings: [], weight: 0, readingWeight: 0 };
      text.readings.push({ group, weight });
      text.readingWeight += weight;
      text.weight = text.readingWeight / text.readings.length;
      texts.set(identity, text);
    }
    tickets = [...texts.values()];
    if (input.staticWeightKey !== undefined) {
      let byCatalog = staticTickets.get(input.frontier);
      if (byCatalog === undefined) {
        byCatalog = new WeakMap(); staticTickets.set(input.frontier, byCatalog);
      }
      let bySampling = byCatalog.get(input.staticWeightKey);
      if (bySampling === undefined) {
        bySampling = new Map(); byCatalog.set(input.staticWeightKey, bySampling);
      }
      bySampling.set(input.sampling, tickets);
    }
  }
  const eligible = (text: TextTicket): boolean => input.sampling === "written-form"
    ? !usedTexts.has(text.identity)
    : !input.usedEntryIds.has(text.identity) || text.identity === input.reusableEntryId;
  const total = tickets.reduce((sum, text) => sum + (eligible(text) ? text.weight : 0), 0);
  if (!Number.isFinite(total)) throw new RangeError("lexical frontier weight overflow");
  if (!(total > 0)) return null;
  let target = unit(input.random) * total;
  for (const text of tickets) {
    if (!eligible(text)) continue;
    if (target >= text.weight) {
      target -= text.weight;
      continue;
    }
    let readingTarget = target / text.weight * text.readingWeight;
    for (const reading of text.readings) {
      if (readingTarget >= reading.weight) {
        readingTarget -= reading.weight;
        continue;
      }
      const profiles = reading.group.profiles;
      return profiles.length === 1 ? profiles[0]!
        : profiles[Math.floor(unit(input.random) * profiles.length)]!;
    }
    return text.readings.at(-1)!.group.profiles[0]!;
  }
  return tickets.filter(eligible).at(-1)!.readings.at(-1)!.group.profiles[0]!;
}
