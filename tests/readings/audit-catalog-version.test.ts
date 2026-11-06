import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { readingAuditCatalog } from "../../scripts/reading-audit-catalog.js";

describe("reading replay catalog versions", () => {
  it("verifies both historical snapshots while retaining current reading additions and stable profile IDs", () => {
    const qianId = catalogEntryId("嵌", "ㄑㄧㄢ1");
    const hanId = catalogEntryId("和", "ㄏㄢ4");
    const historical = readingAuditCatalog("before-qian");
    expect(historical.PRACTICE_CATALOG).toHaveLength(13692);
    expect(historical.SYNTAX_PROFILES).toHaveLength(16061);
    const qian = readingAuditCatalog("qian-catalog");
    expect(qian.PRACTICE_CATALOG).toHaveLength(13693);
    expect(qian.SYNTAX_PROFILES).toHaveLength(16062);
    const historicalIds = new Set(historical.PRACTICE_CATALOG.map(e => e.id));
    expect(qian.PRACTICE_CATALOG.filter(e => !historicalIds.has(e.id)).map(e => e.id)).toEqual([qianId]);
    expect(qian.SYNTAX_PROFILES.filter(p => p.entryId === qianId).map(p => p.id)).toEqual(["runtime-syntax-profile:16061"]);
    expect(qian.SYNTAX_PROFILES.filter(p => p.entryId !== qianId)).toEqual(historical.SYNTAX_PROFILES);
    expect(qian.PRACTICE_CATALOG.some(e => e.id === hanId)).toBe(false);
    expect(historical.PRACTICE_CATALOG.some(e => e.id === hanId)).toBe(false);
    const current = readingAuditCatalog("current");
    expect(current.PRACTICE_CATALOG).toBe(PRACTICE_CATALOG);
    expect(current.SYNTAX_PROFILES).toBe(SYNTAX_PROFILES);
    expect(current.PRACTICE_CATALOG.filter(e => e.id !== hanId)).toEqual(qian.PRACTICE_CATALOG);
    expect(current.SYNTAX_PROFILES.filter(p => p.entryId !== hanId)).toEqual(qian.SYNTAX_PROFILES);
  });
  it("rejects an unknown snapshot rather than silently using the current population", () => {
    expect(() => readingAuditCatalog("unknown")).toThrow(/accepts current, before-qian or qian-catalog/);
  });
});
