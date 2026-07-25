import { readFile } from "node:fs/promises";
import type { CatalogCommonnessBase } from "../../src/core/model.js";
import { compileCatalog } from "../../src/catalog/compile-catalog.js";
import { parseCsv } from "../../src/catalog/csv.js";
import { createProvenanceRegistry } from "../../src/catalog/provenance.js";
import { partitionCatalogForProduct } from "../../src/product/catalog-partition.js";
import { semanticReferenceIdentity } from "../../src/reference/identity.js";
import { createRelationalCatalogReport } from "../../src/relations/catalog-report.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";

/**
 * The fixture catalog carries no frequency evidence of its own. These five
 * words used to be marked less common by hand, and the relation support
 * summaries need that distinction to produce rare-only relations at all, so
 * the fixture states it as the projected weight the model would carry.
 */
const LESS_COMMON_TEXTS = new Set(["工程", "設計", "系統", "資料", "建築"]);

function commonnessBase(entryId: string, selectionWeight: number): CatalogCommonnessBase {
  return {
    modelVersion: "commonness-v1",
    sourceId: "test",
    sourceVersion: "fixture-v1",
    sourceRowId: entryId,
    spokenPerMillion: null,
    writtenPerMillion: null,
    spokenStrength: null,
    writtenStrength: null,
    score: selectionWeight,
    selectionWeight,
    confidence: "reviewed",
    reasons: [],
  };
}

export async function createRealReferenceFixture() {
  const [source, provenanceSource] = await Promise.all([
    readFile(new URL("../fixtures/catalog-baseline-49.csv", import.meta.url), "utf8"),
    readFile(new URL("../../data/provenance.csv", import.meta.url), "utf8"),
  ]);
  const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
  if (provenance.errors.length > 0) throw new Error("invalid provenance fixture");
  const compiled = compileCatalog(parseCsv(source).records, provenance.ids);
  if (compiled.errors.length > 0) throw new Error("invalid catalog fixture");
  const entries = compiled.entries.map((entry) => ({
    ...entry,
    commonnessBase: commonnessBase(
      entry.id,
      LESS_COMMON_TEXTS.has(entry.prompt.text) ? 0.05 : 0.9,
    ),
  }));
  const partition = partitionCatalogForProduct(entries, 5, 3);
  const evaluationIds = new Set(partition.evaluation.map((entry) => entry.id));
  const report = createRelationalCatalogReport(entries, {
    mode: "guided",
    layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
    partitionByEntryId: Object.fromEntries(entries.map((entry) => [
      entry.id,
      evaluationIds.has(entry.id) ? "evaluation" : "training",
    ] as const)),
  });
  const reviewedIdentities = new Set(entries.map((entry) =>
    semanticReferenceIdentity(entry.prompt.text, entry.syllables),
  ));
  return { report, reviewedIdentities };
}
