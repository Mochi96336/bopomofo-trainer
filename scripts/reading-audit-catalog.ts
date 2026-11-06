import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";

/**
 * Frozen be37cac inputs for historical role-stage comparisons. A catalog
 * addition creates a new sampling population even when earlier entries retain
 * their syntax and weights. Verify the entire old snapshot, not only its size.
 */
export function readingAuditCatalog(version = process.env["READING_AUDIT_CATALOG"] ?? "current") {
  if (version === "current") return { PRACTICE_CATALOG, SYNTAX_PROFILES };
  if (version !== "before-qian") throw new Error("READING_AUDIT_CATALOG accepts current or before-qian");
  const added = catalogEntryId("嵌", "ㄑㄧㄢ1");
  const entries = PRACTICE_CATALOG.filter(e => e.id !== added);
  const profiles = SYNTAX_PROFILES.filter(p => p.entryId !== added);
  if (sha256Canonical(entries) !== "d39e3ac2513fedce57b71ae6901ea7830dae90f06dcda581db8fa546f2015b63"
    || sha256Canonical(profiles) !== "8c6c3b1bbebbd43d3c7aa4bc37a44d63121997ab073f96b2a8bdeefde4a80fb7") {
    throw new Error("historical reading catalog/profile snapshot drifted from be37cac");
  }
  return { PRACTICE_CATALOG: entries, SYNTAX_PROFILES: profiles };
}
