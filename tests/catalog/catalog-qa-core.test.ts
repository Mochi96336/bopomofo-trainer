import { describe, expect, it } from "vitest";
import {
  catalogEstimate,
  catalogRate,
  drawStratifiedSample,
  formatAssignedProfiles,
  grammarEvidenceLevel,
  manifestDigest,
  rateOver,
  rowsForStratum,
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

/** Rows shaped as the scorer sees them: a flat record of string columns. */
function drawSheet(
  population: readonly Item[],
  base: number,
  perLevel: number,
): readonly Record<string, string>[] {
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
    floor_for: (sample.floorForOf.get(item.id) ?? []).join("|"),
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

/**
 * What the reviewer is shown, which decides what they are able to catch.
 *
 * The sheet used to carry `assigned_upos` and `assigned_frames` as two
 * separately de-duplicated sets. An entry with several profiles then appeared as
 * "these tags occur, and these frames occur", which is not the claim the runtime
 * makes -- it composes from whole profiles.
 */
describe("assigned profiles on the sheet", () => {
  const correct = [
    { upos: "ADJ", frames: ["intransitive"], evidence: 4 },
    { upos: "ADV", frames: ["avalent"], evidence: 4 },
  ];
  /** Same tags, same frames, same counts, wrong pairing. */
  const swapped = [
    { upos: "ADJ", frames: ["avalent"], evidence: 4 },
    { upos: "ADV", frames: ["intransitive"], evidence: 4 },
  ];

  /** The two columns the sheet used to carry. */
  function flattened(profiles: readonly { upos: string; frames: readonly string[] }[]) {
    return [
      [...new Set(profiles.map((profile) => profile.upos))].sort().join("|"),
      [...new Set(profiles.flatMap((profile) => profile.frames))].sort().join("|"),
    ];
  }

  // The regression. A reviewer looking at the old columns sees nothing wrong
  // with `swapped`, because the old columns cannot express what is wrong with
  // it -- so they mark it `ok` and the measurement misses a whole class of
  // error it claims to count.
  it("distinguishes a mispaired entry that the flattened columns could not", () => {
    expect(flattened(swapped)).toEqual(flattened(correct));
    expect(formatAssignedProfiles(swapped)).not.toBe(formatAssignedProfiles(correct));
  });

  it("reads as one bracketed group per profile", () => {
    expect(formatAssignedProfiles(correct)).toBe("ADJ=4[intransitive] | ADV=4[avalent]");
    expect(formatAssignedProfiles([{ upos: "NOUN", frames: [], evidence: 0 }])).toBe("NOUN=0[]");
    expect(formatAssignedProfiles([])).toBe("");
  });

  // The column is covered by the sheet digest, so an ordering that depends on
  // how the profile file happened to be written would report as tampering.
  it("is canonical, so profile and frame order cannot move the digest", () => {
    expect(formatAssignedProfiles([
      { upos: "VERB", frames: ["transitive", "avalent"], evidence: 7 },
      { upos: "ADJ", frames: ["intransitive"], evidence: 3 },
    ])).toBe(formatAssignedProfiles([
      { upos: "ADJ", frames: ["intransitive"], evidence: 3 },
      { upos: "VERB", frames: ["avalent", "transitive"], evidence: 7 },
    ]));
  });
});

/**
 * The stratum that decides which entries get looked at hardest.
 *
 * It used to add every profile's dependency count together, so an entry could be
 * graded on evidence that belonged to a different role than the weak one. That
 * is backwards for a stratum whose whole job is to reach for the doubtful cases,
 * and it lines up badly with `role_verdict`, which asks whether *any* assignment
 * is wrong.
 */
describe("grammar evidence level", () => {
  const profile = (upos: string, evidence: number) => ({ upos, frames: ["intransitive"], evidence });

  // The regression, in the reviewer's shape: strong evidence on one role must
  // not vouch for a role that has none.
  it("grades an entry on its weakest role, not on the total", () => {
    expect(grammarEvidenceLevel([profile("NOUN", 12), profile("PART", 0)])).toBe("none");
    // Summing gives 12 and calls this the best-evidenced band there is.
    expect(grammarEvidenceLevel([profile("NOUN", 12), profile("PART", 2)])).toBe("weak-1-2");
  });

  // Two thinly-evidenced roles do not add up to one well-evidenced entry.
  it("does not let small counts accumulate into a stronger band", () => {
    expect(grammarEvidenceLevel([profile("ADJ", 2), profile("ADV", 2)])).toBe("weak-1-2");
    expect(grammarEvidenceLevel([profile("ADJ", 5), profile("ADV", 6)])).toBe("moderate-3-9");
  });

  it("still grades a single-profile entry by its own count", () => {
    expect(grammarEvidenceLevel([profile("VERB", 0)])).toBe("none");
    expect(grammarEvidenceLevel([profile("VERB", 2)])).toBe("weak-1-2");
    expect(grammarEvidenceLevel([profile("VERB", 9)])).toBe("moderate-3-9");
    expect(grammarEvidenceLevel([profile("VERB", 10)])).toBe("strong-10-plus");
  });

  it("says when there is no profile at all", () => {
    expect(grammarEvidenceLevel([])).toBe("no-profile");
  });

  // Which role is the weak one has to be visible, or `weak-1-2` on a
  // multi-profile entry tells the reviewer nothing about where to look.
  it("shows each profile's own count on the sheet", () => {
    expect(formatAssignedProfiles([profile("NOUN", 12), profile("PART", 0)]))
      .toBe("NOUN=12[intransitive] | PART=0[intransitive]");
  });
});

/**
 * The metadata beside the sheet, bound so it cannot be edited quietly.
 */
describe("manifest digest", () => {
  const bound = {
    schema: "catalog-qa-sample-v5",
    seed: "catalog-qa-1",
    base: 200,
    perLevel: 25,
    sheetDigest: "abc123",
    recordedSourceDigests: { catalog: "deadbeef" },
  };

  it("is stable and independent of key order", () => {
    expect(manifestDigest(bound)).toBe(manifestDigest({
      recordedSourceDigests: { catalog: "deadbeef" },
      sheetDigest: "abc123",
      perLevel: 25,
      base: 200,
      seed: "catalog-qa-1",
      schema: "catalog-qa-sample-v5",
    }));
  });

  // The regression: a recorded source digest used to be free text that the
  // report reprinted as though it had been checked.
  it("changes when a recorded source digest is edited", () => {
    expect(manifestDigest({ ...bound, recordedSourceDigests: { catalog: "0000" } }))
      .not.toBe(manifestDigest(bound));
  });

  it("changes when the seed or the sheet digest is edited", () => {
    expect(manifestDigest({ ...bound, seed: "other" })).not.toBe(manifestDigest(bound));
    expect(manifestDigest({ ...bound, sheetDigest: "other" })).not.toBe(manifestDigest(bound));
  });
});

/**
 * An unfinished review must not be able to look like a finished measurement.
 *
 * `wrong / (wrong + ok)` drops the blank and `unsure` rows, and those are not
 * missing at random: a reviewer answers the obvious words first and leaves the
 * doubtful ones, so the rows that survive into the denominator are the ones
 * least likely to be wrong. The number that comes out is shaped exactly like the
 * real one -- a percentage with a confidence interval beside it.
 */
describe("catalog estimate completeness", () => {
  function baseRows(verdicts: readonly string[]): readonly Record<string, string>[] {
    return verdicts.map((verdict, index) => ({
      entry_id: `item-${index}`,
      selection: "base",
      floor_for: "",
      verdict,
    }));
  }

  it("gives a point estimate once every base row is answered", () => {
    const estimate = catalogEstimate(baseRows(["wrong", "ok", "ok", "ok"]), "verdict");
    expect(estimate.kind).toBe("point");
    expect(estimate.kind === "point" && estimate.rate).toBe(0.25);
  });

  // The regression: the worst possible case, where every wrong row is one the
  // reviewer could not face. Complete-case counting calls this catalog perfect.
  it("refuses a rate while rows are blank, even where the answered ones give a clean one", () => {
    const rows = baseRows(["ok", "ok", "ok", "ok", "", "", "", ""]);
    expect(catalogRate(rows, "verdict").rate).toBe(0);

    const estimate = catalogEstimate(rows, "verdict");
    expect(estimate.kind).toBe("incomplete");
    expect(estimate.tally).toMatchObject({ total: 8, blank: 4, ok: 4, wrong: 0 });
  });

  it("bounds the rate instead of dropping unsure rows", () => {
    const rows = baseRows(["wrong", "unsure", "unsure", ...Array<string>(17).fill("ok")]);
    const estimate = catalogEstimate(rows, "verdict");
    expect(estimate.kind).toBe("bounded");
    if (estimate.kind !== "bounded") return;
    // 1/20 if both unsure rows are fine, 3/20 if neither is.
    expect(estimate.low).toBeCloseTo(0.05, 10);
    expect(estimate.high).toBeCloseTo(0.15, 10);
    // Complete-case would have said 1/18, inside the bounds and narrower than
    // the evidence supports.
    expect(catalogRate(rows, "verdict").rate).toBeGreaterThan(estimate.low);
    expect(estimate.interval[0]).toBeLessThanOrEqual(estimate.low);
    expect(estimate.interval[1]).toBeGreaterThanOrEqual(estimate.high);
  });

  it("counts every base row in the denominator, answered or not", () => {
    const estimate = catalogEstimate(baseRows(["wrong", "unsure", "ok"]), "verdict");
    expect(estimate.tally.total).toBe(3);
    expect(estimate.kind === "bounded" && estimate.low).toBeCloseTo(1 / 3, 10);
  });

  // Floor rows are not part of the estimate, so leaving one blank cannot hold
  // the headline hostage.
  it("ignores floor rows when deciding whether the sample is complete", () => {
    const rows = [
      ...baseRows(["wrong", "ok", "ok", "ok"]),
      { entry_id: "floor-1", selection: "floor", floor_for: "support", verdict: "" },
    ];
    expect(catalogEstimate(rows, "verdict").kind).toBe("point");
  });

  it("says so when there is nothing to count", () => {
    const estimate = catalogEstimate([], "verdict");
    expect(estimate.kind).toBe("incomplete");
    expect(estimate.tally.total).toBe(0);
  });
});

/**
 * Where a problem is, as opposed to how big it is.
 *
 * The per-level rates had the same flaw as the headline once did, in a form that
 * is harder to notice: a row drawn by one stratum's floor was counted in every
 * other stratum's levels too. Since a floor reaches for what is rare, and rarity
 * is assumed to travel with error, a fault living in one stratum showed up as a
 * fault in its neighbours -- and a diagnostic that points at the wrong data
 * source is worse than none.
 */
describe("per-level localisation", () => {
  const STRATA = ["support", "rarity", "evidence"] as const;

  /** Error confined to `evidence=weak`. Every other stratum is innocent. */
  function buildConfinedPopulation(size: number): readonly Item[] {
    return Array.from({ length: size }, (_unused, index) => {
      const rareSupport = index % 47 === 0;
      const rareRarity = index % 53 === 0;
      const weak = index % 59 === 0;
      return {
        id: `item-${String(index).padStart(5, "0")}`,
        strata: {
          support: rareSupport ? "unsupported" : "supported",
          rarity: rareRarity ? "rare" : "common",
          evidence: weak ? "weak" : "strong",
        },
        wrong: weak && index % 5 !== 0,
      };
    });
  }

  const population = buildConfinedPopulation(6000);
  const rows = drawSheet(population, 400, 30);

  function trueRateFor(stratum: string, level: string): number {
    const inLevel = population.filter((item) => item.strata[stratum] === level);
    return inLevel.filter((item) => item.wrong).length / inLevel.length;
  }

  it("keeps every level's interval around that level's true rate", () => {
    for (const stratum of STRATA) {
      const eligible = rowsForStratum(rows, stratum);
      for (const level of new Set(population.map((item) => item.strata[stratum] ?? ""))) {
        const estimate = rateOver(
          eligible.filter((row) => row[stratum] === level),
          "verdict",
        );
        if (estimate.judged === 0) continue;
        const truth = trueRateFor(stratum, level);
        expect(truth).toBeGreaterThanOrEqual(estimate.interval[0]);
        expect(truth).toBeLessThanOrEqual(estimate.interval[1]);
      }
    }
  });

  // The regression: counting every sampled row lights up strata that are fine.
  it("would blame an innocent stratum if rows from other floors were counted", () => {
    const truth = trueRateFor("support", "supported");
    const naive = rateOver(rows.filter((row) => row["support"] === "supported"), "verdict");
    const fair = rateOver(
      rowsForStratum(rows, "support").filter((row) => row["support"] === "supported"),
      "verdict",
    );

    expect(naive.rate ?? 0).toBeGreaterThan(fair.rate ?? 0);
    // Far enough out to be read as a finding rather than as noise.
    expect(naive.rate ?? 0).toBeGreaterThan(fair.interval[1]);
    expect(Math.abs((fair.rate ?? 0) - truth)).toBeLessThan(Math.abs((naive.rate ?? 0) - truth));
  });

  it("admits base rows and this stratum's own floor, and nothing else", () => {
    const eligible = rowsForStratum(rows, "support");
    expect(eligible.every((row) =>
      row["selection"] === "base" || (row["floor_for"] ?? "").split("|").includes("support")
    )).toBe(true);
    const excluded = rows.filter((row) => !eligible.includes(row));
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.every((row) => row["selection"] === "floor")).toBe(true);
  });
});
