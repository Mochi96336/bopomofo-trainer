/**
 * Active build/review tooling entry point.
 *
 * This surface compiles and audits the reviewed catalog and syntax artifacts.
 * It is intentionally separate from the browser/product runtime entry point.
 */
export * from "./core/model.js";
export * from "./scheme/tokens.js";
export * from "./scheme/standard-layout.js";
export * from "./scheme/syllable-grammar.js";
export * from "./scheme/parse-reading.js";

export * from "./catalog/types.js";
export * from "./catalog/csv.js";
export * from "./catalog/compile-catalog.js";
export * from "./catalog/provenance.js";
export * from "./catalog/coverage.js";

export * from "./grammar/types.js";
export * from "./grammar/compile-annotations.js";
export * from "./grammar/compose.js";

export * from "./syntax/profile-projection.js";
export * from "./syntax/profile-match.js";
export * from "./syntax/rule-index.js";
export * from "./syntax/catalog-legality.js";
export * from "./syntax/runtime-profiles.js";

export * from "./reference/types.js";
export * from "./reference/manifest-parser.js";
export * from "./reference/source-registry.js";
export * from "./reference/compile-reference.js";
export * from "./reference/identity.js";
export * from "./reference/contribution-types.js";
export * from "./reference/contribution.js";
export * from "./reference/ranking-types.js";
export * from "./reference/ranking.js";
export * from "./reference/importers/types.js";
export * from "./reference/importers/tabular-adapter.js";
export * from "./reference/importers/import-reference-source.js";
export * from "./reference/importers/serialize.js";
