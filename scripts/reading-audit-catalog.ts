import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";

/**
 * Frozen be37cac, b792f75 and 9d8f1e0 inputs for historical comparisons. A catalog
 * addition creates a new sampling population even when earlier entries retain
 * their syntax and weights. Verify the entire old snapshot, not only its size.
 */
export function readingAuditCatalog(version = process.env["READING_AUDIT_CATALOG"] ?? "current") {
  if (version === "current") return { PRACTICE_CATALOG, SYNTAX_PROFILES };
  const qian = catalogEntryId("嵌", "ㄑㄧㄢ1");
  const han = catalogEntryId("和", "ㄏㄢ4");
  const pianyi = catalogEntryId("便宜", "ㄆㄧㄢ2 ㄧ2");
  const snapshots = [
    { version: "before-qian", sourceCommit: "be37cac", excludedEntryIds: [qian, han, pianyi],
      entriesDigest: "d39e3ac2513fedce57b71ae6901ea7830dae90f06dcda581db8fa546f2015b63",
      profilesDigest: "8c6c3b1bbebbd43d3c7aa4bc37a44d63121997ab073f96b2a8bdeefde4a80fb7" },
    { version: "qian-catalog", sourceCommit: "b792f75", excludedEntryIds: [han, pianyi],
      entriesDigest: "3e9a2ed90608fc051798ec6ed28c5d9559411d0309578343d98e29384a57924c",
      profilesDigest: "6f2ddb6a842d54390bbfd268513964428e407b030ac3bc27bf1bd3edeaea84fe" },
    { version: "han-catalog", sourceCommit: "9d8f1e0", excludedEntryIds: [pianyi],
      entriesDigest: "7be2c55a57e94a28302f6ba35a76d59452e0a295b67733ccdc0bc50b67b6ca7c",
      profilesDigest: "79231c1030441e9fd12a976bd8180caf9cfbfd5a162211b8f5b471d373f04426" },
  ] as const;
  const snapshot = snapshots.find(s => s.version === version);
  if (snapshot === undefined) throw new Error("READING_AUDIT_CATALOG accepts current, before-qian, qian-catalog or han-catalog");
  const excluded = new Set(snapshot.excludedEntryIds);
  const entries = PRACTICE_CATALOG.filter(e => !excluded.has(e.id));
  const profiles = SYNTAX_PROFILES.filter(p => !excluded.has(p.entryId));
  if (sha256Canonical(entries) !== snapshot.entriesDigest || sha256Canonical(profiles) !== snapshot.profilesDigest) {
    throw new Error("historical reading catalog/profile snapshot drifted from " + snapshot.sourceCommit);
  }
  return { PRACTICE_CATALOG: entries, SYNTAX_PROFILES: profiles };
}
