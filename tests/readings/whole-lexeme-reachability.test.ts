import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { GrammarUtteranceCandidate } from "../../src/grammar/types.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import {
  inspectHostLexemeReadiness,
  inspectHostLexemeSelection,
} from "../../src/readings/whole-lexeme-reachability.js";

const word = (text: string, reading: string): CatalogEntry => ({
  id: catalogEntryId(text, reading),
  prompt: { text, locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄓ", "tone:3"] }],
  tags: [],
  provenanceIds: [],
});
const profile = (entry: CatalogEntry): RuntimeSyntaxProfile => ({
  id: "profile:" + entry.id,
  entryId: entry.id,
  upos: "VERB",
  functions: ["predicate"],
  valencyFrames: ["intransitive"],
  dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
  provenanceIds: [],
});
const candidate = (text: string, entries: readonly CatalogEntry[], profileIds?: readonly string[]) =>
  ({ text, entries, ...(profileIds ? { syntaxProfileIds: profileIds } : {}) } as GrammarUtteranceCandidate);

describe("whole-host lexical reachability is entry-ID based", () => {
  const host = word("遊說", "ㄧㄡ2 ㄕㄨㄟ4");
  const separated = [word("遊", "ㄧㄡ2"), word("說", "ㄕㄨㄟ4")];
  const hprofile = profile(host);
  const inspect = inspectHostLexemeReadiness("遊說", [host, ...separated], [hprofile]);
  const profiles = new Map([[hprofile.id, hprofile]]);

  it("reports the independently selected host rather than matching characters", () => {
    const atomic = inspectHostLexemeSelection(candidate("遊說。", [host], [hprofile.id]), inspect, profiles);
    expect(atomic).toEqual({
      atomicHostOccurrences: 1, hostEntryIds: [host.id],
      hostProfileIds: [hprofile.id], surfaceOnlyCollision: false,
    });
    const separate = inspectHostLexemeSelection(candidate("遊說。", separated), inspect, profiles);
    expect(separate).toEqual({
      atomicHostOccurrences: 0, hostEntryIds: [],
      hostProfileIds: [], surfaceOnlyCollision: true,
    });
    expect(inspectHostLexemeSelection(candidate("遊說。", [host]), inspect, profiles).atomicHostOccurrences).toBe(1);
    expect(inspectHostLexemeSelection(candidate("他說。", separated), inspect, profiles).surfaceOnlyCollision).toBe(false);
  });

  it("refuses mismatched candidate profile alignment", () => {
    expect(() => inspectHostLexemeSelection(
      candidate("遊說", [host], ["unregistered"]), inspect, profiles,
    )).toThrow("profile/entry identity mismatch");
    expect(() => inspectHostLexemeSelection(
      candidate("遊說", [host], ["profile:a", "profile:b"]), inspect, profiles,
    )).toThrow("alignment mismatch");
    const other = profile(separated[1]!);
    expect(() => inspectHostLexemeSelection(
      candidate("遊說", [host], [other.id]), inspect,
      new Map([...profiles, [other.id, other]]),
    )).toThrow("profile/entry identity mismatch");
  });

  it("does not promote unavailable compound hosts or isolated reading identities", () => {
    const absent = inspectHostLexemeReadiness("成為", [host, ...separated], [hprofile]);
    expect(absent.status).toBe("absent-from-catalog");
    expect(absent.exactEntryIds).toEqual([]);
    expect(inspectHostLexemeReadiness("遊說", [host, ...separated], []).status)
      .toBe("no-runtime-profile");
    expect(inspect.status).toBe("licensed-profile-present");
    expect(() => inspectHostLexemeReadiness("說", [host], [])).toThrow("multi-character");
  });

  it("pins what can actually be attempted on the active main catalog", () => {
    const states = ["遊說", "自給自足", "成為"].map(
      text => inspectHostLexemeReadiness(text, PRACTICE_CATALOG, SYNTAX_PROFILES).status,
    );
    expect(states).toEqual([
      "licensed-profile-present", "absent-from-catalog", "absent-from-catalog",
    ]);
  });
});
