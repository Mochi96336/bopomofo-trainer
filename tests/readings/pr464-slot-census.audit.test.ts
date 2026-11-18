import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import { updateFrequencyFirstSelectionState } from "../../src/curriculum/frequency-first-utterance.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

type Frontier = readonly RuntimeSyntaxProfile[];
type Filter = (frontier: Frontier, entriesById: ReadonlyMap<string, CatalogEntry>) => Frontier;
type Gate = (entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: unknown, previous: CatalogEntry | null) => boolean;
type MutablePolicy = { readingFrontierFilter: Filter; readingEligibility: Gate };

function slotContext(slot: unknown, previous: CatalogEntry | null) {
  const s = slot as Record<string, unknown> | null;
  const requirements = s === null ? null : {
    allowedUpos: s.allowedUpos ?? null,
    requiredFunctions: s.requiredFunctions ?? null,
    requiredValencyFrames: s.requiredValencyFrames ?? null,
    requiredOccurrenceCapabilities: s.requiredOccurrenceCapabilities ?? null,
    requiredFeatures: s.requiredFeatures ?? null,
    enclosingRequiredFunctions: s.enclosingRequiredFunctions ?? null,
    entryBindingId: s.entryBindingId ?? null,
  };
  return { requirements, previousWord: previous?.prompt.text ?? null, previousId: previous?.id ?? null };
}

interface GroupCount {
  text: string;
  upos: string;
  frontierVisits: number;
  readingIds: Set<string>;
  profileIds: Set<string>;
  slotContexts: Set<string>;
  examples: { slot: ReturnType<typeof slotContext> | null; readings: string[] }[];
}
interface Counters {
  filterCalls: number;
  licensedProfilesExamined: number;
  allowedProfiles: number;
  removedProfiles: number;
  changedCalls: number;
  removalGroupVisits: number;
  groups: Map<string, GroupCount>;
  contextWithoutGate: number;
}

describe("PR #464 read-only dynamic lexical frontier census", () => {
  it("counts precise license-before-abstention losses in the real 128-delivery product sampling scopes", () => {
    // This changes only the injected hook, in this isolated test worker, then restores it.
    // It must not change the production filter's return value or the chosen exercises.
    const mutable = PRODUCT_READING_POLICY as unknown as MutablePolicy;
    const originalFilter = mutable.readingFrontierFilter;
    const originalGate = mutable.readingEligibility;
    let current: ReturnType<typeof slotContext> | null = null;
    let active: Counters | null = null;
    mutable.readingEligibility = (entry, profile, slot, previous) => {
      current = slotContext(slot, previous);
      return originalGate(entry, profile, slot, previous);
    };
    mutable.readingFrontierFilter = (frontier, entriesById) => {
      const retained = originalFilter(frontier, entriesById);
      if (active === null) return retained;
      active.filterCalls += 1;
      active.licensedProfilesExamined += frontier.length;
      active.allowedProfiles += retained.length;
      const permittedIds = new Set(retained.map(profile => profile.id));
      const removed = frontier.filter(profile => !permittedIds.has(profile.id));
      active.removedProfiles += removed.length;
      if (removed.length > 0) active.changedCalls += 1;
      if (removed.length > 0 && current === null) active.contextWithoutGate += 1;
      const inThisCall = new Map<string, RuntimeSyntaxProfile[]>();
      for (const profile of removed) {
        const entry = entriesById.get(profile.entryId);
        if (entry === undefined) throw Error("unmapped profile");
        const key = JSON.stringify([entry.prompt.text, profile.upos]);
        const batch = inThisCall.get(key) ?? [];
        batch.push(profile);
        inThisCall.set(key, batch);
      }
      for (const [key, profiles] of inThisCall) {
        const [text, upos] = JSON.parse(key) as [string, string];
        const group = active.groups.get(key) ?? {
          text, upos, frontierVisits: 0, readingIds: new Set<string>(),
          profileIds: new Set<string>(), slotContexts: new Set<string>(),
          examples: [],
        };
        group.frontierVisits += 1;
        for (const profile of profiles) {
          group.readingIds.add(profile.entryId);
          group.profileIds.add(profile.id);
        }
        if (current !== null) group.slotContexts.add(JSON.stringify(current));
        if (group.examples.length < 2) {
          group.examples.push({ slot: current, readings: [...new Set(profiles.map(p => p.entryId))].sort() });
        }
        active.groups.set(key, group);
        active.removalGroupVisits += 1;
      }
      current = null;
      return retained;
    };
    try {
      const whole = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
      const scenarios = [];
      for (const tier of [null, ...COMMONNESS_TIERS]) {
        const catalogs = tier === null ? whole : catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [tier]);
        const environment = createProductEnvironment(catalogs);
        let progress = createFreshProgressForEnvironment(
          environment, "selection-quality-v2:" + (tier ?? "all"), "guided", "standard",
        );
        const counters: Counters = {
          filterCalls: 0, licensedProfilesExamined: 0, allowedProfiles: 0,
          removedProfiles: 0, changedCalls: 0, removalGroupVisits: 0,
          contextWithoutGate: 0, groups: new Map(),
        };
        active = counters;
        const seenWords = new Set<string>();
        let lexicalOccurrences = 0;
        for (let round = 0; round < 128; round += 1) {
          const state = createProductState(environment, progress, 0);
          for (const entry of state.round.selection.utterance.entries) {
            seenWords.add(entry.prompt.text);
            lexicalOccurrences += 1;
          }
          const selection = state.round.selection;
          progress = { ...progress, practiceRoundsCompleted: round + 1,
            selection: updateFrequencyFirstSelectionState(progress.selection, selection, environment.utterancePolicy) };
        }
        const rows = [...counters.groups.values()].map(g => ({
          word: g.text, upos: g.upos, frontierVisits: g.frontierVisits,
          blockedReadings: [...g.readingIds].sort(), blockedProfiles: g.profileIds.size,
          distinctObservedContexts: g.slotContexts.size, examples: g.examples,
        })).sort((a,b) => b.frontierVisits - a.frontierVisits || a.word.localeCompare(b.word, "zh-Hant"));
        scenarios.push({
          tier: tier ?? "all", samples: 128, catalogEntries: catalogs.practice.length,
          deliveredUniqueWords: seenWords.size, deliveredLexicalOccurrences: lexicalOccurrences,
          filterCalls: counters.filterCalls, changedCalls: counters.changedCalls,
          licensedProfilesExamined: counters.licensedProfilesExamined,
          retainedProfiles: counters.allowedProfiles, removedProfiles: counters.removedProfiles,
          removalGroupVisits: counters.removalGroupVisits,
          distinctBlockedWordUposGroups: rows.length,
          distinctBlockedReadingIds: new Set(rows.flatMap(row=>row.blockedReadings)).size,
          contextWithoutGate: counters.contextWithoutGate,
        });
        active = null;
      }
      expect(scenarios.map(s => s.deliveredUniqueWords)).toEqual([373, 304, 280, 294, 300]);
      expect(scenarios.every(s => s.contextWithoutGate === 0)).toBe(true);
      console.log("PR464_SLOT_CENSUS_JSON_BEGIN");
      console.log(JSON.stringify({ version: "pr465-compact-slot-census-v1", baseCommit: "2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1", scopes: scenarios,
        limitation: "Exact licensed frontier removals for the executed 128-delivery sampling paths, including failed/retried slots; not all possible grammar slots, not proof of correct pronunciation or of lost final-probability mass." }));
      console.log("PR464_SLOT_CENSUS_JSON_END");
    } finally {
      active = null;
      mutable.readingFrontierFilter = originalFilter;
      mutable.readingEligibility = originalGate;
    }
  }, 240_000);
});