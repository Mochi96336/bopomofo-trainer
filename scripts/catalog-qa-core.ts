import { createHash } from "node:crypto";

/**
 * The parts of catalog sampling QA that are decisions rather than plumbing.
 *
 * They live apart from `sample-catalog-qa.ts` because that file is a command:
 * importing it runs it. What is here is how the sample is selected and how the
 * catalog rate is computed from it, which is exactly what went wrong once and
 * exactly what a test has to be able to reach.
 */

/** How a row came to be in the sheet, which decides what it may be used for. */
export type Selection = "base" | "floor";

export interface StratifiedSample<T> {
  readonly rows: readonly T[];
  readonly selectionOf: ReadonlyMap<string, Selection>;
  /**
   * Which strata's floors reached for each row.
   *
   * Recorded because it decides what the row may be counted in. A row drawn by
   * the `cedict` floor is a uniform pick from its own cedict level, and says
   * nothing unbiased about its `commonness` level -- it is there for being rare
   * in cedict, and rarity travels with error. Reading rates per level needs to
   * know which floor put each row on the sheet, so this has to reach the scorer.
   */
  readonly floorForOf: ReadonlyMap<string, readonly string[]>;
}

/**
 * Deterministic by seed, so the same population and seed always draw the same
 * rows.
 *
 * A sample nobody can reproduce cannot be reviewed in a pull request, and a
 * sample drawn afresh on every run cannot be compared with the last.
 */
export function createRandom(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  return () => {
    hash = (hash + 0x6d2b79f5) >>> 0;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A uniform base plus a floor for every level of every stratum.
 *
 * The two halves answer different questions and are marked apart because of it.
 * The base is a plain uniform sample and is the only thing an estimate may be
 * computed from. The floor exists so the levels carrying the risk have enough
 * rows to say anything about, and whether a row lands in it depends on all the
 * strata at once -- so within any single level the floor rows over-represent
 * whatever is rare on the others, and their rate is not the level's rate.
 */
export function drawStratifiedSample<T>(
  population: readonly T[],
  options: {
    readonly idOf: (item: T) => string;
    readonly strataOf: (item: T) => Readonly<Record<string, string>>;
    readonly stratumNames: readonly string[];
    readonly seed: string;
    readonly base: number;
    readonly perLevel: number;
  },
): StratifiedSample<T> {
  const random = createRandom(options.seed);
  const shuffled = [...population]
    .map((item) => ({ item, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ item }) => item);

  const selectionOf = new Map<string, Selection>();
  const floorForOf = new Map<string, string[]>();
  const chosen = new Map<string, T>();
  for (const item of shuffled.slice(0, options.base)) {
    chosen.set(options.idOf(item), item);
    selectionOf.set(options.idOf(item), "base");
  }
  for (const name of options.stratumNames) {
    const byLevel = new Map<string, T[]>();
    for (const item of shuffled) {
      const level = options.strataOf(item)[name];
      if (level === undefined) continue;
      const list = byLevel.get(level);
      if (list === undefined) byLevel.set(level, [item]);
      else list.push(item);
    }
    for (const list of byLevel.values()) {
      for (const item of list.slice(0, options.perLevel)) {
        const id = options.idOf(item);
        chosen.set(id, item);
        if (!selectionOf.has(id)) selectionOf.set(id, "floor");
        const drawnBy = floorForOf.get(id);
        if (drawnBy === undefined) floorForOf.set(id, [name]);
        else drawnBy.push(name);
      }
    }
  }

  return {
    rows: [...chosen.values()],
    selectionOf,
    floorForOf,
  };
}

/**
 * The rows that may be counted for one level of one stratum.
 *
 * A row qualifies if it is a base row, or if this stratum's own floor is what
 * reached for it. Both are uniform picks within the level: base membership and
 * within-level floor membership are decided by shuffle rank alone, which is
 * independent of anything the review will find. Their union is therefore still
 * an unbiased sample of the level.
 *
 * A row drawn only by some other stratum's floor does not qualify. It is on the
 * sheet because it was rare on that other dimension, and if error tracks rarity
 * -- the premise of the whole scheme -- counting it here inflates whichever
 * level of this stratum it happens to fall in. That is how a problem sitting in
 * one stratum shows up as a problem in a neighbouring one.
 */
export function rowsForStratum(
  rows: readonly Readonly<Record<string, string>>[],
  stratum: string,
): readonly Readonly<Record<string, string>>[] {
  return rows.filter((row) => {
    if ((row["selection"] ?? "") === "base") return true;
    return (row["floor_for"] ?? "").split("|").includes(stratum);
  });
}

/**
 * Wilson score interval, which stays sensible near 0 and on small samples where
 * the textbook normal interval does not.
 *
 * A point estimate off a couple of hundred rows invites more confidence than it
 * has earned. Printing the interval beside it is the cheapest way to stop the
 * headline being read as exact.
 */
export function wilsonInterval(wrong: number, judged: number): readonly [number, number] {
  if (judged === 0) return [0, 1];
  const z = 1.96;
  const proportion = wrong / judged;
  const denominator = 1 + (z * z) / judged;
  const centre = proportion + (z * z) / (2 * judged);
  const spread = z * Math.sqrt(
    (proportion * (1 - proportion)) / judged + (z * z) / (4 * judged * judged),
  );
  return [
    Math.max(0, (centre - spread) / denominator),
    Math.min(1, (centre + spread) / denominator),
  ];
}

export interface RateEstimate {
  readonly wrong: number;
  readonly judged: number;
  readonly unsure: number;
  readonly rate: number | null;
  readonly interval: readonly [number, number];
}

/**
 * The catalog rate, counted over the uniform rows and no others.
 *
 * Floor rows are excluded on purpose and the exclusion is the whole point: they
 * are drawn because of what is rare about them, so including them measures the
 * sheet rather than the catalog. Reweighting them by one stratum's catalog share
 * does not fix that, because their selection depended on every other stratum
 * too -- which is how this was wrong before.
 *
 * This is the complete-case count, over answered rows only, and is not what the
 * report quotes: `catalogEstimate` wraps it with what the blank and `unsure`
 * rows do to the claim.
 */
export function catalogRate(
  rows: readonly Readonly<Record<string, string>>[],
  verdictColumn: string,
): RateEstimate {
  return rateOver(rows.filter((row) => (row["selection"] ?? "") === "base"), verdictColumn);
}

/**
 * Counts verdicts over exactly the rows given, with an interval.
 *
 * Whether those rows are a fair sample of anything is the caller's problem --
 * `catalogRate` and `rowsForStratum` are the two answers to that question, and
 * nothing else should be passing a row set in here.
 */
export function rateOver(
  rows: readonly Readonly<Record<string, string>>[],
  verdictColumn: string,
): RateEstimate {
  let wrong = 0;
  let ok = 0;
  let unsure = 0;
  for (const row of rows) {
    const verdict = (row[verdictColumn] ?? "").trim();
    if (verdict === "wrong") wrong += 1;
    else if (verdict === "ok") ok += 1;
    else if (verdict === "unsure") unsure += 1;
  }
  const judged = wrong + ok;
  return {
    wrong,
    judged,
    unsure,
    rate: judged === 0 ? null : wrong / judged,
    interval: wilsonInterval(wrong, judged),
  };
}

/** One runtime syntax profile: a UPOS tag together with the frames it licenses. */
export interface AssignedProfile {
  readonly upos: string;
  readonly frames: readonly string[];
  /** Observed dependencies standing behind this profile, not behind the entry. */
  readonly evidence: number;
}

/**
 * How much evidence stands behind the *least* supported role on an entry.
 *
 * Summing across profiles was wrong in the direction that matters. An entry
 * assigned NOUN on twelve observed dependencies and PART on two came out as
 * `strong-10-plus`, so the stratum reached for it as a safe case while the role
 * actually at risk sat inside it unexamined -- 1,494 entries are graded above
 * their weakest role that way, 427 of them as `strong-10-plus`.
 *
 * The minimum is the reading that matches what the reviewer is asked: a
 * `role_verdict` is `wrong` if *any* assignment is wrong, so the level has to
 * describe the assignment most likely to be it. An entry is only well-evidenced
 * when all of its roles are.
 */
export function grammarEvidenceLevel(profiles: readonly AssignedProfile[]): string {
  if (profiles.length === 0) return "no-profile";
  const weakest = Math.min(...profiles.map((profile) => profile.evidence));
  if (weakest === 0) return "none";
  // Split where the roadmap's risk lives: a role assigned from one or two
  // observed dependencies is a very different claim from one assigned from many.
  if (weakest <= 2) return "weak-1-2";
  if (weakest <= 9) return "moderate-3-9";
  return "strong-10-plus";
}

/**
 * The assigned profiles as a reviewer has to see them: pairing intact.
 *
 * The sheet used to carry two flattened sets -- every distinct UPOS in one
 * column, every distinct frame in another. That cannot express which tag
 * licensed which frame, so a swap between two profiles of the same entry is
 * invisible: `ADJ[intransitive] ADV[avalent]` and `ADJ[avalent]
 * ADV[intransitive]` produce identical columns, and a reviewer reading them
 * marks a genuinely wrong entry `ok`. The runtime composes from whole profiles,
 * not from two independent sets, so the sheet has to show whole profiles.
 *
 * Each profile carries its own evidence count, because the stratum reports only
 * the weakest one and a reviewer looking at a `weak-1-2` entry needs to see
 * which role is the weak one.
 *
 * Canonicalised by sorting, at both levels, because this string is covered by
 * the sheet digest and profile order carries no meaning.
 */
export function formatAssignedProfiles(profiles: readonly AssignedProfile[]): string {
  return profiles
    .map((profile) => `${profile.upos}=${profile.evidence}[${[...profile.frames].sort().join(",")}]`)
    .sort()
    .join(" | ");
}

/** Every base row accounted for, including the ones nobody answered. */
export interface BaseTally {
  readonly total: number;
  readonly wrong: number;
  readonly ok: number;
  readonly unsure: number;
  readonly blank: number;
}

/**
 * What may honestly be said about the catalog given how far the review has got.
 *
 * `point` is the only quotable one. The others exist because the complete-case
 * rate -- `wrong / (wrong + ok)` -- silently drops the rows nobody answered, and
 * those rows are not missing at random. A reviewer works through the easy words
 * first and leaves the doubtful ones blank, or marks them `unsure`; both habits
 * strip exactly the rows most likely to be wrong out of the denominator. The
 * survivors are then no longer a uniform sample of anything, and an interval
 * computed over them describes the rows that happened to get answered rather
 * than the catalog.
 */
export type CatalogEstimate =
  /** Rows are still blank. There is no estimate yet, only progress. */
  | { readonly kind: "incomplete"; readonly tally: BaseTally }
  /**
   * Every row answered, some as `unsure`. The rate is known to lie between
   * "every unsure is fine" and "every unsure is wrong" and cannot be narrowed
   * without answering them, so both ends are reported.
   */
  | {
    readonly kind: "bounded";
    readonly tally: BaseTally;
    readonly low: number;
    readonly high: number;
    readonly interval: readonly [number, number];
  }
  /** Every row answered `ok` or `wrong`. This is the number to quote. */
  | {
    readonly kind: "point";
    readonly tally: BaseTally;
    readonly rate: number;
    readonly interval: readonly [number, number];
  };

export function baseTally(
  rows: readonly Readonly<Record<string, string>>[],
  verdictColumn: string,
): BaseTally {
  const base = rows.filter((row) => (row["selection"] ?? "") === "base");
  const counted = rateOver(base, verdictColumn);
  return {
    total: base.length,
    wrong: counted.wrong,
    ok: counted.judged - counted.wrong,
    unsure: counted.unsure,
    blank: base.length - counted.judged - counted.unsure,
  };
}

/**
 * The headline, or an explanation of why there is not one yet.
 *
 * Denominators are the whole base sample rather than the answered part of it,
 * so an unfinished or selectively answered review cannot present itself as a
 * measurement. See `CatalogEstimate`.
 */
export function catalogEstimate(
  rows: readonly Readonly<Record<string, string>>[],
  verdictColumn: string,
): CatalogEstimate {
  const tally = baseTally(rows, verdictColumn);
  if (tally.total === 0 || tally.blank > 0) return { kind: "incomplete", tally };
  if (tally.unsure > 0) {
    return {
      kind: "bounded",
      tally,
      low: tally.wrong / tally.total,
      high: (tally.wrong + tally.unsure) / tally.total,
      // Sampling error on top of the unresolved rows: the lowest the rate could
      // be if every unsure turns out fine, to the highest if none of them do.
      interval: [
        wilsonInterval(tally.wrong, tally.total)[0],
        wilsonInterval(tally.wrong + tally.unsure, tally.total)[1],
      ],
    };
  }
  return {
    kind: "point",
    tally,
    rate: tally.wrong / tally.total,
    interval: wilsonInterval(tally.wrong, tally.total),
  };
}

export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvLine(fields: readonly string[]): string {
  return fields.map(csvField).join(",");
}

/**
 * A digest over everything in the sheet that the reviewer must not change.
 *
 * Verdicts and notes are excluded, because filling those in is the point.
 * Everything else -- which entries were drawn, in what order, how each was
 * selected, and the strata each was classified into -- is what the numbers are
 * computed against, so the scorer refuses to report anything if it has moved.
 * Sorting a spreadsheet by a column and saving it is enough to do that.
 *
 * Computed over parsed values rather than raw bytes, so a spreadsheet that
 * requotes a field on the way out does not read as tampering.
 */
export function sheetDigest(fixedRows: readonly (readonly string[])[]): string {
  const canonical = fixedRows.map((row) => row.map(csvField).join(",")).join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Ties the metadata to the sheet it was drawn with.
 *
 * `sheetDigest` covers the CSV and nothing else, so everything recorded beside
 * it -- the seed, the sample sizes, and the source digests naming the catalog
 * state the sample was drawn from -- could be edited freely while the sheet
 * still verified. The scorer then reprinted those values as though checking them
 * had meant something.
 *
 * What this buys is limited and worth stating plainly: a digest stored next to
 * the data it covers detects an accidental edit or a mismatched pair, not a
 * determined one, since whoever edits the file can recompute this too. The
 * record that cannot be quietly rewritten is the commit history. What it does
 * remove is the appearance of verification where there was none.
 */
export function manifestDigest(fields: Readonly<Record<string, unknown>>): string {
  const canonical = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${JSON.stringify(fields[key])}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
