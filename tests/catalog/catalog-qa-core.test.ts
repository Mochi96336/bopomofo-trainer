import { describe, expect, it } from "vitest";
import {
  catalogRate,
  drawStratifiedSample,
  sheetDigest,
  wilsonInterval,
} from "../../scripts/catalog-qa-core.js";

/**
 * The sampling QA estimator, pinned against the mistake it already made once.
 *
 * The catalog rate was originally computed over every sampled row and reweighted
 * by each stratum's catalog share. That is biased: the floor draws rows because
 * of what is rare about them, and a row's presence depends on all six strata at
 * once, so within any one level the sampled rows over-represent whatever is rare
 * on the other five. If error tracks rarity -- the assumption the whole scheme
 * rests on -- the reweighted figure runs high.
 *
 * The check that missed it varied error along one stratum only, which is the one
 * shape of data the flawed estimator handles correctly. The population below is
 * built the opposite way on purpose.
 */

const STRATUM_NAMES = ["support", "rarity", "evidence"] as const;

interface Item {
  readonly id: string;
  readonly strata: Readonly<Record<string, string>>;
  readonly wrong: boolean;
}

/**
 * A population where risk stacks across strata rather than sitting in one.
 *
 * The rare levels are genuinely rare -- a fiftieth or so each, like
 * `manual-override` or `multi-reading` in the real catalog -- because that is
 * what makes the floor reach for rows a uniform draw would have missed. An
 * earlier version of this fixture made them a ninth each, and the floor then
 * added nothing the base did not already hold: no floor rows, no bias, and a
 * test that proved nothing.
 *
 * Rare items are wrong far more often than common ones, so the rows the floor
 * reaches for are exactly the wrong ones. That is what turns a naive
 * reweighting upward, and it is the shape the real catalog is assumed to have.
 */
function buildPopulation(size: number): readonly Item[] {
  const items: Item[] = [];
  for (let index = 0; index < size; index += 1) {
    const rareSupport = index % 47 === 0;
    const rareRarity = index % 53 === 0;
    const rareEvidence = index % 59 === 0;
    const rare = rareSupport || rareRarity || rareEvidence;
    items.push({
      id: `item-${String(index).padStart(5, "0")}`,
      strata: {
        support: rareSupport ? "unsupported" : "supported",
        rarity: rareRarity ? "rare" : "common",
        evidence: rareEvidence ? "weak" : "strong",
      },
      // Deterministic: about 80% of rare items are wrong against about 8% of
      // common ones.
      wrong: rare ? index % 5 !== 0 : index % 12 === 0,
    });
  }
  return items;
}

function drawSheet(population: readonly Item[], base: number, perLevel: number) {
  const sample = drawStratifiedSample(population, {
    idOf: (item) => item.id,
    strataOf: (item) => item.strata,
    stratumNames: STRATUM_NAMES,
    seed: "test-seed",
    base,
    perLevel,
  });
  const byId = new Map(population.map((item) => [item.id, item] as const));
  return sample.rows.map((item) => ({
    entry_id: item.id,
    selection: sample.selectionOf.get(item.id) ?? "floor",
    ...item.strata,
    verdict: byId.get(item.id)?.wrong === true ? "wrong" : "ok",
  }));
}

/** What the estimator used to do, kept here only so its bias stays visible. */
function reweightedRate(
  rows: readonly Readonly<Record<string, string>>[],
  population: readonly Item[],
  stratum: string,
): number {
  const counts = new Map<string, number>();
  for (const item of population) {
    const level = item.strata[stratum] ?? "?";
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  let weighted = 0;
  for (const [level, count] of counts) {
    const inLevel = rows.filter((row) => row[stratum] === level);
    if (inLevel.length === 0) continue;
    const wrong = inLevel.filter((row) => row["verdict"] === "wrong").length;
    weighted += (count / population.length) * (wrong / inLevel.length);
  }
  return weighted;
}

describe("catalog QA estimator", () => {
  const population = buildPopulation(6000);
  const trueRate = population.filter((item) => item.wrong).length / population.length;
  const rows = drawSheet(population, 400, 30);

  it("marks base rows apart from floor rows", () => {
    const base = rows.filter((row) => row.selection === "base");
    const floor = rows.filter((row) => row.selection === "floor");
    expect(base).toHaveLength(400);
    expect(floor.length).toBeGreaterThan(0);
    expect(base.length + floor.length).toBe(rows.length);
  });

  it("recovers the population rate from the base rows", () => {
    const estimate = catalogRate(rows, "verdict");
    expect(estimate.judged).toBe(400);
    expect(estimate.rate).not.toBeNull();
    const [low, high] = estimate.interval;
    expect(trueRate).toBeGreaterThanOrEqual(low);
    expect(trueRate).toBeLessThanOrEqual(high);
  });

  // The regression this file exists for. Reweighting every sampled row by one
  // stratum's catalog share overstates the rate here, on every stratum -- which
  // is why the headline may only ever count base rows.
  it("would overstate the rate if the floor rows were reweighted in", () => {
    for (const stratum of STRATUM_NAMES) {
      expect(reweightedRate(rows, population, stratum)).toBeGreaterThan(trueRate);
    }
    const estimate = catalogRate(rows, "verdict");
    const worst = Math.max(
      ...STRATUM_NAMES.map((stratum) => reweightedRate(rows, population, stratum)),
    );
    expect(worst - trueRate).toBeGreaterThan(Math.abs((estimate.rate ?? 0) - trueRate));
  });

  // Directly pins the exclusion: a floor row's verdict must not move the number.
  it("ignores floor verdicts entirely", () => {
    const before = catalogRate(rows, "verdict");
    const flipped = rows.map((row) =>
      row.selection === "floor" ? { ...row, verdict: row.verdict === "wrong" ? "ok" : "wrong" } : row
    );
    expect(catalogRate(flipped, "verdict")).toEqual(before);
  });

  it("moves when a base verdict changes, so it is not ignoring everything", () => {
    const before = catalogRate(rows, "verdict");
    const flipped = rows.map((row, index) =>
      index === rows.findIndex((candidate) => candidate.selection === "base" && candidate.verdict === "ok")
        ? { ...row, verdict: "wrong" }
        : row
    );
    expect(catalogRate(flipped, "verdict").wrong).toBe(before.wrong + 1);
  });

  it("counts unsure apart from the judged rows", () => {
    const withUnsure = rows.map((row, index) =>
      row.selection === "base" && index % 5 === 0 ? { ...row, verdict: "unsure" } : row
    );
    const estimate = catalogRate(withUnsure, "verdict");
    expect(estimate.unsure).toBeGreaterThan(0);
    expect(estimate.judged).toBe(400 - estimate.unsure);
  });
});

describe("sample draw determinism", () => {
  it("draws the same rows for the same seed and different rows for another", () => {
    const population = buildPopulation(2000);
    const options = {
      idOf: (item: Item) => item.id,
      strataOf: (item: Item) => item.strata,
      stratumNames: STRATUM_NAMES,
      base: 100,
      perLevel: 10,
    };
    const first = drawStratifiedSample(population, { ...options, seed: "a" });
    const again = drawStratifiedSample(population, { ...options, seed: "a" });
    const other = drawStratifiedSample(population, { ...options, seed: "b" });

    expect(again.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
    expect(other.rows.map((row) => row.id)).not.toEqual(first.rows.map((row) => row.id));
  });
});

describe("sheet digest", () => {
  const sheet = [["a", "base", "x"], ["b", "floor", "y"]];

  it("is stable for the same rows and changes when a row moves", () => {
    expect(sheetDigest(sheet)).toBe(sheetDigest([["a", "base", "x"], ["b", "floor", "y"]]));
    expect(sheetDigest([...sheet].reverse())).not.toBe(sheetDigest(sheet));
  });

  it("changes when a stratum is edited", () => {
    expect(sheetDigest([["a", "base", "z"], ["b", "floor", "y"]])).not.toBe(sheetDigest(sheet));
  });
});

describe("wilson interval", () => {
  it("brackets the observed proportion and stays inside 0..1 at the extremes", () => {
    const [low, high] = wilsonInterval(20, 200);
    expect(low).toBeLessThan(0.1);
    expect(high).toBeGreaterThan(0.1);

    expect(wilsonInterval(0, 50)[0]).toBe(0);
    expect(wilsonInterval(50, 50)[1]).toBe(1);
  });

  it("narrows as the sample grows", () => {
    const [smallLow, smallHigh] = wilsonInterval(10, 100);
    const [largeLow, largeHigh] = wilsonInterval(100, 1000);
    expect(largeHigh - largeLow).toBeLessThan(smallHigh - smallLow);
  });
});
