import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG } from "../src/app/generated/catalog.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { buildPolyphonicReadingIndex } from "../src/readings/polyphonic-audit.js";

/**
 * Derive the pilot from the *packaged active catalog*, never from guessed
 * dictionary readings or raw provisional CSV. Output is research-only.
 *
 * npm run app:catalog
 * npx tsx scripts/prepare-moe-sense-targets.ts
 */
const PILOT_TEXTS = ["種", "說", "東西", "給", "為"] as const;
const OUTPUT = "data/generated/moe-sense-pilot-targets.json";
const activeById = new Map(PRACTICE_CATALOG.map(entry => [entry.id, entry]));
const ambiguous = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
const rows = PILOT_TEXTS.flatMap(text => {
  const ids = ambiguous.get(text);
  if (ids === undefined || ids.length < 2) {
    throw new Error("pilot text is not polyphonic in the packaged catalog: " + text);
  }
  return ids.map(entryId => {
    const prefix = "word:" + text + ":";
    if (!entryId.startsWith(prefix) || !activeById.has(entryId)) {
      throw new Error("pilot identity is inconsistent with catalog: " + entryId);
    }
    const reading = entryId.slice(prefix.length).replaceAll("-", " ");
    if (catalogEntryId(text, reading) !== entryId) {
      throw new Error("pilot entry ID cannot be reversed without loss: " + entryId);
    }
    return { text, reading, entryId, reviewStatus: "pending-source-evidence" as const };
  });
});
const output = {
  schemaVersion: "moe-sense-pilot-targets-v1",
  source: "packaged-active-practice-catalog",
  purpose: "Only exact reading identity targets; NOT human-reviewed lexical senses.",
  pilotTexts: PILOT_TEXTS,
  rows,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output: OUTPUT,
  pilotTexts: PILOT_TEXTS,
  readingIdentities: rows.length,
  pendingSenseReviews: rows.length,
}, null, 2));
