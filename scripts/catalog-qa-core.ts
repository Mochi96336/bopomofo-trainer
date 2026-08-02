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
      }
    }
  }

  return {
    rows: [...chosen.values()],
    selectionOf,
  };
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
 */
export function catalogRate(
  rows: readonly Readonly<Record<string, string>>[],
  verdictColumn: string,
): RateEstimate {
  let wrong = 0;
  let ok = 0;
  let unsure = 0;
  for (const row of rows) {
    if ((row["selection"] ?? "") !== "base") continue;
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
