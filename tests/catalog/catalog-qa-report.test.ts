import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/catalog/csv.js";
import {
  CATALOG_QA_HEADERS,
  catalogQaHeaderError,
  metadataIntegrityDigest,
} from "../../scripts/catalog-qa-core.js";
import { buildColumnReport, renderColumnReport } from "../../scripts/catalog-qa-report.js";

/**
 * What the scorer is allowed to report, tested as a value.
 *
 * The rule used to live in a wrapper that captured the command's stdout and
 * filtered it by line prefix. Its tests were written against a hand-made copy of
 * the output, so they could not tell whether the wrapper and the command still
 * agreed -- and they did not notice when a one-word wording change in the
 * command switched the guard off entirely.
 */

const STRATA = ["support", "cedict"] as const;

interface RowSpec {
  readonly selection: "base" | "floor";
  readonly floorFor?: string;
  readonly support: string;
  readonly cedict: string;
  readonly verdict: string;
}

function rows(specs: readonly RowSpec[]): readonly Record<string, string>[] {
  return specs.map((spec, index) => ({
    entry_id: `item-${index}`,
    selection: spec.selection,
    floor_for: spec.floorFor ?? "",
    support: spec.support,
    cedict: spec.cedict,
    verdict: spec.verdict,
  }));
}

function base(support: string, cedict: string, verdict: string): RowSpec {
  return { selection: "base", support, cedict, verdict };
}

function levelOf(report: ReturnType<typeof buildColumnReport>, stratum: string, level: string) {
  return report.strata
    .find((entry) => entry.name === stratum)
    ?.levels.find((entry) => entry.level === level);
}

describe("per-level reportability", () => {
  // The regression. A row that only some other stratum drew, left unanswered,
  // used to withhold every level of every stratum -- so one `unsure` out of 259
  // suppressed all six, in a protocol that tells reviewers to use `unsure`.
  it("judges each level on its own rows, not on the whole sheet", () => {
    const report = buildColumnReport(rows([
      base("covered", "unique", "ok"),
      base("covered", "unique", "wrong"),
      base("covered", "unique", "ok"),
      base("covered", "unique", "ok"),
      // Drawn only by the cedict floor, and unanswered.
      { selection: "floor", floorFor: "cedict", support: "gap", cedict: "absent", verdict: "" },
    ]), "reading", "verdict", STRATA);

    expect(levelOf(report, "support", "covered")?.estimate.kind).toBe("point");
    expect(levelOf(report, "cedict", "absent")?.estimate.kind).toBe("incomplete");
    // The unanswered floor row is not a support row, so it cannot reach it.
    expect(levelOf(report, "support", "gap")).toBeUndefined();
  });

  it("gives an unsure level a range rather than withholding it", () => {
    const report = buildColumnReport(rows([
      base("covered", "unique", "wrong"),
      base("covered", "unique", "unsure"),
      ...Array.from({ length: 8 }, () => base("covered", "unique", "ok")),
    ]), "reading", "verdict", STRATA);

    const level = levelOf(report, "support", "covered")?.estimate;
    expect(level?.kind).toBe("bounded");
    if (level?.kind !== "bounded") return;
    expect(level.low).toBeCloseTo(0.1, 10);
    expect(level.high).toBeCloseTo(0.2, 10);
    // The denominator is the whole level, not the answered part of it.
    expect(level.tally.total).toBe(10);
  });

  it("withholds only the level that has a blank row", () => {
    const report = buildColumnReport(rows([
      base("covered", "unique", "ok"),
      base("covered", "unique", "wrong"),
      base("gap", "unique", ""),
      base("gap", "unique", "ok"),
    ]), "reading", "verdict", STRATA);

    expect(levelOf(report, "support", "covered")?.estimate.kind).toBe("point");
    expect(levelOf(report, "support", "gap")?.estimate.kind).toBe("incomplete");
    // Both support levels feed cedict=unique, so that one is held back too --
    // by its own rows, which is the point.
    expect(levelOf(report, "cedict", "unique")?.estimate.kind).toBe("incomplete");
  });

  it("counts a stratum's own floor rows but not another stratum's", () => {
    const report = buildColumnReport(rows([
      base("covered", "unique", "ok"),
      { selection: "floor", floorFor: "support", support: "gap", cedict: "absent", verdict: "wrong" },
      { selection: "floor", floorFor: "cedict", support: "gap", cedict: "absent", verdict: "wrong" },
    ]), "reading", "verdict", STRATA);

    // support=gap sees only the support floor row.
    expect(levelOf(report, "support", "gap")?.estimate.tally.total).toBe(1);
    // cedict=absent sees only the cedict floor row.
    expect(levelOf(report, "cedict", "absent")?.estimate.tally.total).toBe(1);
  });

  it("keeps the headline on base rows while a floor row is blank", () => {
    const report = buildColumnReport(rows([
      base("covered", "unique", "wrong"),
      ...Array.from({ length: 9 }, () => base("covered", "unique", "ok")),
      { selection: "floor", floorFor: "support", support: "gap", cedict: "absent", verdict: "" },
    ]), "reading", "verdict", STRATA);

    expect(report.headline.kind).toBe("point");
    expect(report.headline.tally.total).toBe(10);
  });
});

describe("report rendering", () => {
  const report = buildColumnReport(rows([
    base("covered", "unique", "wrong"),
    base("covered", "unique", "unsure"),
    ...Array.from({ length: 8 }, () => base("covered", "unique", "ok")),
    { selection: "floor", floorFor: "cedict", support: "gap", cedict: "absent", verdict: "" },
  ]), "reading", "verdict", STRATA);

  // Renders what the model says, so a wording change cannot alter a decision --
  // there is no string here that any rule reads back.
  it("shows a range for the bounded level and withholds the blank one", () => {
    const text = renderColumnReport(report);
    expect(text).toContain("## reading");
    expect(text).toContain("covered");
    expect(text).toMatch(/covered\s+10\.0%–20\.0%/u);
    expect(text).toMatch(/absent\s+not reportable\s+\(1 of 1 rows blank\)/u);
  });
});

describe("sheet header contract", () => {
  it("accepts the exact drawn sequence and rejects relabelled verdict columns", () => {
    expect(catalogQaHeaderError(CATALOG_QA_HEADERS)).toBeNull();

    const swapped: string[] = [...CATALOG_QA_HEADERS];
    const reading = swapped.indexOf("reading_verdict");
    const role = swapped.indexOf("role_verdict");
    [swapped[reading], swapped[role]] = [swapped[role] ?? "", swapped[reading] ?? ""];
    expect(catalogQaHeaderError(swapped)).toContain("expected columns in this exact order");
  });

  it("rejects duplicate and missing columns", () => {
    const duplicated: string[] = [...CATALOG_QA_HEADERS];
    duplicated[duplicated.indexOf("role_verdict")] = "reading_verdict";
    expect(catalogQaHeaderError(duplicated)).toContain('column "reading_verdict" appears more than once');
    expect(catalogQaHeaderError(CATALOG_QA_HEADERS.slice(0, -1)))
      .toContain("expected columns in this exact order");
  });

  // The list above is written out by hand, so it can drift from what the draw
  // emits. This is what stops that: the committed sheet is what the draw wrote.
  it("matches the header of the committed review sheet", () => {
    const source = readFileSync(new URL("../../data/qa/catalog-sample.csv", import.meta.url), "utf8");
    expect(parseCsv(source.replace(/^﻿/u, "")).headers).toEqual([...CATALOG_QA_HEADERS]);
  });
});

describe("metadata integrity digest", () => {
  const metadata = {
    schema: "catalog-qa-sample-v5",
    seed: "catalog-qa-1",
    catalogEntryCount: 13897,
    sampleSize: 259,
    strata: { support: { catalog: { covered: 100 }, sampled: { covered: 25 } } },
    drawnAt: "2026-08-02T18:53:50.514Z",
  };

  it("covers the descriptive fields the manifest digest leaves loose", () => {
    const digest = metadataIntegrityDigest(metadata);
    expect(metadataIntegrityDigest({ ...metadata, catalogEntryCount: 13898 })).not.toBe(digest);
    expect(metadataIntegrityDigest({ ...metadata, sampleSize: 260 })).not.toBe(digest);
    expect(metadataIntegrityDigest({
      ...metadata,
      strata: { support: { catalog: { covered: 101 }, sampled: { covered: 25 } } },
    })).not.toBe(digest);
    expect(metadataIntegrityDigest({ ...metadata, drawnAt: "later" })).not.toBe(digest);
  });

  it("does not cover its own field", () => {
    expect(metadataIntegrityDigest({ ...metadata, integrityDigest: "old" }))
      .toBe(metadataIntegrityDigest({ ...metadata, integrityDigest: "new" }));
  });

  // What the scorer actually checks, against the sheet that is committed.
  it("agrees with the committed sample metadata", () => {
    const meta = JSON.parse(
      readFileSync(new URL("../../data/qa/catalog-sample.meta.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;
    expect(meta["integrityDigest"]).toBe(metadataIntegrityDigest(meta));
  });
});
