import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/catalog/csv.js";
import {
  CONSTRUCTION_READINGS,
  LICENSED_CONSTRUCTION_FORMS,
} from "../../src/syntax/lexical-feature-match.js";

async function activeCatalogReadingsByText(): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const source = await readFile(
    new URL("../../data/source/words.sample.csv", import.meta.url),
    "utf8",
  );
  const readings = new Map<string, Set<string>>();
  for (const record of parseCsv(source).records) {
    if ((record.values.status ?? "") === "excluded") continue;
    const text = record.values.text ?? "";
    const reading = record.values.reading ?? "";
    if (!text || !reading) continue;
    const values = readings.get(text) ?? new Set<string>();
    values.add(reading);
    readings.set(text, values);
  }
  return readings;
}

describe("lexical construction catalog identity", () => {
  it("pins a reading for every licensed form the catalog writes more than one way", async () => {
    const catalog = await activeCatalogReadingsByText();
    const unpinnedHomographs = [...LICENSED_CONSTRUCTION_FORMS]
      .filter((form) => (catalog.get(form)?.size ?? 0) > 1)
      .filter((form) => CONSTRUCTION_READINGS[form] === undefined)
      .sort();
    // A licensed homograph without a pinned reading would inherit the
    // construction profile on every one of its readings.
    expect(unpinnedHomographs).toEqual([]);
  });

  it("pins only readings the catalog actually carries", async () => {
    const catalog = await activeCatalogReadingsByText();
    const missing = Object.entries(CONSTRUCTION_READINGS)
      .flatMap(([form, readings]) =>
        readings
          .filter((reading) => !(catalog.get(form)?.has(reading) ?? false))
          .map((reading) => `${form}:${reading}`)
      )
      .sort();
    // A typo here fails closed silently and removes the construction from the
    // grammar, so it has to be an assertion rather than a comment.
    expect(missing).toEqual([]);
  });

  it("does not pin forms that no licensing table can reach", () => {
    const unreachable = Object.keys(CONSTRUCTION_READINGS)
      .filter((form) => !LICENSED_CONSTRUCTION_FORMS.has(form))
      .sort();
    expect(unreachable).toEqual([]);
  });
});
