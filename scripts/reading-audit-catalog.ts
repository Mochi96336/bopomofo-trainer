import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";

/**
 * Frozen be37cac and b792f75 inputs for historical role-stage comparisons. A catalog
 * addition creates a new sampling population even when earlier entries retain
 * their syntax and weights. Verify the entire old snapshot, not only its size.
 */
export function readingAuditCatalog(version = process.env["READING_AUDIT_CATALOG"] ?? "current") {
  if (version === "current") return { PRACTICE_CATALOG, SYNTAX_PROFILES };
  const qian = catalogEntryId("嵌", "ㄑㄧㄢ1");
  const han = catalogEntryId("和", "ㄏㄢ4");
  const snapshots = [
    { version: "before-qian", sourceCommit: "be37cac", excludedEntryIds: [qian, han],
      entriesDigest: "d39e3ac2513fedce57b71ae6901ea7830dae90f06dcda581db8fa546f2015b63",
      profilesDigest: "8c6c3b1bbebbd43d3c7aa4bc37a44d63121997ab073f96b2a8bdeefde4a80fb7" },
    { version: "qian-catalog", sourceCommit: "b792f75", excludedEntryIds: [han],
      entriesDigest: "3e9a2ed90608fc051798ec6ed28c5d9559411d0309578343d98e29384a57924c",
      profilesDigest: "6f2ddb6a842d54390bbfd268513964428e407b030ac3bc27bf1bd3edeaea84fe" },
  ] as const;
  const snapshot = snapshots.find(s => s.version === version);
  if (snapshot === undefined) throw new Error("READING_AUDIT_CATALOG accepts current, before-qian or qian-catalog");
  const excluded = new Set(snapshot.excludedEntryIds);
  const entries = PRACTICE_CATALOG.filter(e => !excluded.has(e.id));
  const profiles = SYNTAX_PROFILES.filter(p => !excluded.has(p.entryId));
  if (sha256Canonical(entries) !== snapshot.entriesDigest || sha256Canonical(profiles) !== snapshot.profilesDigest) {
    throw new Error("historical reading catalog/profile snapshot drifted from " + snapshot.sourceCommit);
  }
  return { PRACTICE_CATALOG: entries, SYNTAX_PROFILES: profiles };
}
