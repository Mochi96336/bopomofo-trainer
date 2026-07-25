/**
 * One-shot migration for a catalog *shape* change.
 *
 * The packaged syntax artifacts pin themselves to `sha256Canonical(entries)`.
 * Removing a field from `CatalogEntry` changes that digest even though nothing
 * about syntax legality or the profile projection changed, and the artifacts
 * cannot be rebuilt here: their generation inputs live in ignored local
 * directories, so a rebuild would silently regenerate them from whatever stale
 * source happens to be present.
 *
 * This re-stamps only `catalogDigest` and `determinismDigest`, and refuses to
 * do even that unless the entry identities are byte-for-byte the ones the
 * artifact was built against -- which is the property that makes the re-stamp
 * safe rather than a rubber stamp.
 */
import { readFile, writeFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

interface DigestStampedArtifact {
  readonly catalogEntryCount: number;
  readonly catalogDigest: string;
  readonly determinismDigest: string;
  readonly [key: string]: unknown;
}

const [resolvedSource, provenanceSource] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
]);

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}
const compiled = compileCatalog(resolvedSource.records, provenance.ids);
if (compiled.errors.length > 0) {
  throw new Error(
    compiled.errors.map((error) => `row ${error.rowNumber}: ${error.message}`).join("\n"),
  );
}
const entries = compiled.entries;
const entryIds = new Set(entries.map((entry) => entry.id));

function referencedEntryIds(artifact: DigestStampedArtifact): readonly string[] {
  const ids: string[] = [];
  for (const value of Object.values(artifact)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string") ids.push(item);
      else if (typeof item === "object" && item !== null && "entryId" in item) {
        ids.push(String((item as { entryId: unknown }).entryId));
      }
    }
  }
  return ids;
}

for (const name of [
  "formal-syntax-active-catalog-legality.json",
  "formal-syntax-active-catalog-profiles.json",
]) {
  const url = new URL(`../data/grammar/${name}`, import.meta.url);
  const artifact = JSON.parse(await readFile(url, "utf8")) as DigestStampedArtifact;

  if (artifact.catalogEntryCount !== entries.length) {
    throw new Error(`${name}: catalog entry count changed; rebuild instead of re-stamping`);
  }
  const unknown = referencedEntryIds(artifact).filter((id) => id.startsWith("word:") && !entryIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`${name}: references ${unknown.length} unknown entries; rebuild instead of re-stamping`);
  }

  const { determinismDigest: _previous, ...core } = {
    ...artifact,
    catalogDigest: sha256Canonical(entries),
  };
  const restamped = { ...core, determinismDigest: sha256Canonical(core) };
  await writeFile(url, `${JSON.stringify(restamped)}\n`, "utf8");
  console.log(`${name}: catalogDigest ${artifact.catalogDigest} -> ${restamped.catalogDigest}`);
}
