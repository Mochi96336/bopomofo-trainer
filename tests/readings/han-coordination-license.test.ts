import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { reviewedClosedClassReadingEligible } from "../../src/readings/closed-class-license.js";
import {
  HAN_COORDINATION_ENTRY_ID,
  hanCoordinationProfileLicensed,
  reviewedHanCoordinationReadingEligible,
} from "../../src/readings/han-coordination-license.js";
import {
  PRODUCT_READING_POLICY,
  PRODUCT_READING_POLICY_ID,
  productReadingEligibleWithoutPreviousEntry,
} from "../../src/readings/product-reading-policy.js";
import { lexicalConstructionFeatureMatches } from "../../src/syntax/lexical-feature-match.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

const heId = catalogEntryId("和", "ㄏㄜ2");
const artifact = JSON.parse(readFileSync(
  new URL("../../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url),
  "utf8",
)) as { readonly profiles: readonly RuntimeSyntaxProfile[] };
const heProfiles = artifact.profiles.filter(profile => profile.entryId === heId);

function entry(reading = "ㄏㄢ4"): CatalogEntry {
  return {
    id: catalogEntryId("和", reading),
    prompt: { text: "和", locale: "zh-TW" },
    syllables: [{ tokens: [
      ...[...reading.slice(0, -1)].map(symbol => "zhuyin:" + symbol),
      "tone:" + reading.slice(-1),
    ] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function actualProfile(upos: Upos, entryId = HAN_COORDINATION_ENTRY_ID): RuntimeSyntaxProfile {
  const source = heProfiles.find(profile => profile.upos === upos);
  if (source === undefined) throw new Error("missing actual 和/hé profile: " + upos);
  return { ...source, id: "test:" + entryId + ":" + upos, entryId };
}

describe("source-backed 和 hàn coordinator license", () => {
  it("admits only the actual CCONJ evidence among the four shared written-form profiles", () => {
    expect(heProfiles.map(profile => profile.upos).sort()).toEqual(["ADP", "CCONJ", "NOUN", "PROPN"]);
    expect(actualProfile("CCONJ").dependencyEvidence.dependencyRelationCounts).toEqual({ cc: 769 });
    for (const source of heProfiles) {
      const profile = actualProfile(source.upos);
      const licensed = source.upos === "CCONJ";
      expect(hanCoordinationProfileLicensed(HAN_COORDINATION_ENTRY_ID, profile)).toBe(licensed);
      expect(reviewedHanCoordinationReadingEligible(entry(), profile)).toBe(licensed);
      expect(PRODUCT_READING_POLICY.preDrawReadingEligibility(entry(), profile, null, null)).toBe(licensed);
      expect(PRODUCT_READING_POLICY.readingEligibility(entry(), profile, null, null)).toBe(licensed);
      expect(productReadingEligibleWithoutPreviousEntry(entry(), profile)).toBe(licensed);
    }
    expect(PRODUCT_READING_POLICY_ID).toBe("standard-han-coordination-trial");
  });

  it("does not mistake the real mixed ADP/coordinator/cc profile for a CCONJ license", () => {
    const profile = actualProfile("ADP");
    expect(profile.functions).toContain("coordinator");
    expect(profile.dependencyEvidence.dependencyRelationCounts).toEqual({ case: 73, cc: 1 });
    expect(hanCoordinationProfileLicensed(HAN_COORDINATION_ENTRY_ID, profile)).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      HAN_COORDINATION_ENTRY_ID, "和", profile, "coordinationType", "coordination",
    )).toBe(false);
  });

  it("requires coordinator function and positive cc evidence together", () => {
    const source = actualProfile("CCONJ");
    const missingFunction: RuntimeSyntaxProfile = { ...source, functions: ["unspecified"] };
    const noCc: RuntimeSyntaxProfile = {
      ...source,
      dependencyEvidence: { ...source.dependencyEvidence, dependencyRelationCounts: { cc: 0 } },
    };
    const absentCc: RuntimeSyntaxProfile = {
      ...source,
      dependencyEvidence: { ...source.dependencyEvidence, dependencyRelationCounts: {} },
    };
    for (const profile of [missingFunction, noCc, absentCc]) {
      expect(reviewedHanCoordinationReadingEligible(entry(), profile)).toBe(false);
      expect(lexicalConstructionFeatureMatches(
        HAN_COORDINATION_ENTRY_ID, "和", profile, "coordinationType", "coordination",
      )).toBe(false);
    }
  });

  it("checks the selected entry/profile identity instead of borrowing hé evidence by reference", () => {
    const heProfile = actualProfile("CCONJ", heId);
    expect(() => reviewedHanCoordinationReadingEligible(entry(), heProfile)).toThrow(/selected catalog identity/);
    expect(hanCoordinationProfileLicensed(HAN_COORDINATION_ENTRY_ID, heProfile)).toBe(false);
    expect(hanCoordinationProfileLicensed(heId, heProfile)).toBe(false);
    expect(hanCoordinationProfileLicensed(undefined, actualProfile("CCONJ"))).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      HAN_COORDINATION_ENTRY_ID, "和", heProfile, "coordinationType", "coordination",
    )).toBe(false);
  });

  it("licenses hàn only for coordination and preserves the hé relational-ccomp marker", () => {
    const coordinator = actualProfile("CCONJ");
    expect(lexicalConstructionFeatureMatches(
      HAN_COORDINATION_ENTRY_ID, "和", coordinator, "coordinationType", "coordination",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      HAN_COORDINATION_ENTRY_ID, "和", coordinator, "coordinationType", "additive",
    )).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      HAN_COORDINATION_ENTRY_ID, "和", coordinator, "clauseType", "request",
    )).toBe(false);
    for (const upos of ["CCONJ", "ADP"] as const) {
      expect(lexicalConstructionFeatureMatches(
        HAN_COORDINATION_ENTRY_ID, "和", actualProfile(upos), "clauseType", "relational-ccomp",
      )).toBe(false);
    }
    expect(lexicalConstructionFeatureMatches(
      heId, "和", actualProfile("ADP", heId), "clauseType", "relational-ccomp",
    )).toBe(true);
  });

  it("keeps existing hé roles and admits both reviewed coordinator readings", () => {
    for (const source of heProfiles) {
      expect(reviewedHanCoordinationReadingEligible(entry("ㄏㄜ2"), source)).toBe(true);
      expect(PRODUCT_READING_POLICY.preDrawReadingEligibility(entry("ㄏㄜ2"), source, null, null)).toBe(true);
      expect(PRODUCT_READING_POLICY.readingEligibility(entry("ㄏㄜ2"), source, null, null)).toBe(true);
    }
    for (const reading of ["ㄏㄜ2", "ㄏㄢ4"]) {
      const selected = entry(reading);
      const profile = actualProfile("CCONJ", selected.id);
      expect(reviewedClosedClassReadingEligible(selected, profile)).toBe(true);
      expect(lexicalConstructionFeatureMatches(
        selected.id, "和", profile, "coordinationType", "coordination",
      )).toBe(true);
    }
    const other = entry("ㄏㄨㄛ4");
    const otherProfile = actualProfile("CCONJ", other.id);
    expect(reviewedHanCoordinationReadingEligible(other, otherProfile)).toBe(true);
    expect(reviewedClosedClassReadingEligible(other, otherProfile)).toBe(false);
  });
});
