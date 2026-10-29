import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG } from "../src/app/generated/catalog.js";
import type { CatalogEntry } from "../src/core/model.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

/**
 * Direct exact-word reading identity cross-check against the pinned MOE
 * Concised SINGLE-READING projection. Not a classifier and not a semantic
 * sentence review. Only report disagreements; never silently replace a
 * learner's reading or remove legitimate polyphonic exercises.
 */
export interface UniqueMoeRow {
  readonly lookupText: string;
  readonly trainerReading: string;
  readonly sourceEntryId: string;
}
export interface WordReadingConflict {
  readonly text: string;
  readonly catalogEntryId: string;
  readonly moeEntryId: string;
  readonly moeReading: string;
  readonly sourceEntryId: string;
  readonly selectionWeight: number | null;
}
export function compareSingleReadingCatalog(
  catalog: readonly CatalogEntry[],
  authority: readonly UniqueMoeRow[],
): {
  readonly scopedMoeTexts: number;
  readonly scopedCatalogTexts: number;
  readonly exactMatches: number;
  readonly potentialConflicts: readonly WordReadingConflict[];
  readonly excludedCatalogMultiReadingTexts: number;
  readonly notInShippedCatalog: number;
} {
  const entriesByText = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const arr = entriesByText.get(entry.prompt.text) ?? [];
    arr.push(entry);
    entriesByText.set(entry.prompt.text, arr);
  }
  const uniqueSource = new Map<string, UniqueMoeRow>();
  for (const row of authority) {
    if (!row.lookupText || !row.trainerReading || !row.sourceEntryId) {
      throw new Error("invalid MOE unique-reading row");
    }
    const prior = uniqueSource.get(row.lookupText);
    if (prior !== undefined) {
      throw new Error("MOE projection unexpectedly contains duplicate headword: " + row.lookupText);
    }
    uniqueSource.set(row.lookupText, row);
  }
  let scopedCatalogTexts = 0;
  let exactMatches = 0;
  let excludedCatalogMultiReadingTexts = 0;
  let notInShippedCatalog = 0;
  const potentialConflicts: WordReadingConflict[] = [];
  for (const [text, row] of uniqueSource) {
    const candidates = entriesByText.get(text) ?? [];
    if (candidates.length === 0) {
      notInShippedCatalog++;
      continue;
    }
    if (candidates.length !== 1) {
      // A text having >1 licensed reading is *not* a single-reading
      // identity in the shipping catalog, even if source projection
      // metadata is stale or broader than the current selection.
      excludedCatalogMultiReadingTexts++;
      continue;
    }
    scopedCatalogTexts++;
    const selected = candidates[0]!;
    const expectedId = catalogEntryId(text, row.trainerReading);
    if (selected.id === expectedId) {
      exactMatches++;
      continue;
    }
    potentialConflicts.push({
      text,
      catalogEntryId: selected.id,
      moeEntryId: expectedId,
      moeReading: row.trainerReading,
      sourceEntryId: row.sourceEntryId,
      selectionWeight: selected.commonnessBase?.selectionWeight ?? null,
    });
  }
  potentialConflicts.sort((a,b) =>
    (b.selectionWeight ?? 0)-(a.selectionWeight ?? 0)
    || a.text.localeCompare(b.text, "zh-Hant")
  );
  if(scopedCatalogTexts!==exactMatches+potentialConflicts.length) {
    throw new Error("single-reading identity accounting mismatch");
  }
  return {
    scopedMoeTexts:uniqueSource.size,
    scopedCatalogTexts,
    exactMatches,
    potentialConflicts,
    excludedCatalogMultiReadingTexts,
    notInShippedCatalog,
  };
}

async function main():Promise<void> {
  const raw=JSON.parse(await readFile(
    new URL("../data/readings/moe-concised-2014_20260626-active-catalog.json",import.meta.url),
    "utf8"
  )) as {adapterVersion:string;rows:UniqueMoeRow[]};
  if(raw.adapterVersion!=="moe-concised-reading-adapter-v1"||!Array.isArray(raw.rows)) {
    throw new Error("invalid pinned MOE single-reading projection");
  }
  const comparison=compareSingleReadingCatalog(PRACTICE_CATALOG,raw.rows);
  const out={
    schemaVersion:"moe-single-reading-catalog-identity-crosscheck-v1",
    scope:"Exact full-word single-reading MOE projection vs one currently shipped catalog identity",
    status:"potential source disagreements only; independent decision not yet made",
    sourceVersion:"2014_20260626",
    ...comparison,
    note:"No multi-reading text is automatically rejected. Source discrepancies must be individually checked before any correction. No sentence naturalness analysis.",
  };
  const path="data/generated/moe-single-reading-catalog-crosscheck.json";
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,JSON.stringify(out,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    path,
    scopedMoeTexts:out.scopedMoeTexts,
    scopedCatalogTexts:out.scopedCatalogTexts,
    exactMatches:out.exactMatches,
    potentialConflicts:out.potentialConflicts.length,
    excludedCatalogMultiReadingTexts:out.excludedCatalogMultiReadingTexts,
    notInShippedCatalog:out.notInShippedCatalog,
    topConflicts:out.potentialConflicts.slice(0,25),
  },null,2));
}

if(process.argv[1]?.endsWith("audit-moe-single-reading-conflicts.ts")) {
  await main();
}
