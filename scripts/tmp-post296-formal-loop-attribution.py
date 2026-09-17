from pathlib import Path

path = Path("src/curriculum/formal-syntax-utterance.ts")
text = path.read_text()

old = '''const compatibleProfileGroupsCache = new WeakMap<
  readonly RuntimeSyntaxProfile[],
  readonly CompatibleProfileGroup[]
>();
'''
new = '''const compatibleProfileGroupsCache = new WeakMap<
  readonly RuntimeSyntaxProfile[],
  readonly CompatibleProfileGroup[]
>();

const FORMAL_LOOP_ATTRIBUTION = {
  composeCalls: 0,
  sameCanonicalCalls: 0,
  sameCanonicalRuleMapVisits: 0,
  sameCanonicalEveryVisits: 0,
  sameCanonicalJsonStringifies: 0,
  sentenceRuleFilterVisits: 0,
  sentenceRulesKept: 0,
  groupedCalls: 0,
  groupedCacheHits: 0,
  groupedCacheMisses: 0,
  groupedSourceProfiles: 0,
  groupedBuiltGroups: 0,
  selectCalls: 0,
  sourceGroups: 0,
  groupFilterVisits: 0,
  groupsFilteredByReuse: 0,
  eligibleGroups: 0,
  groupWeightVisits: 0,
  dynamicEntryWeightUses: 0,
  mappedEntryWeightUses: 0,
  defaultEntryWeightUses: 0,
  surfaceCompatibilityCalls: 0,
  weightedIndexCalls: 0,
  weightedValidationVisits: 0,
  weightedReduceVisits: 0,
  weightedSelectionLoopVisits: 0,
  weightedZeroTotals: 0,
  selectedGroupProfiles: 0,
  selectedSingletonProfileGroups: 0,
  selectedMultiProfileGroups: 0,
  selectedProfileRandomDraws: 0,
  reachabilityCalls: 0,
  reachabilityPunctuationFastPath: 0,
  reachabilityCompatibleProfileItems: 0,
  reachabilityCompatible: 0,
  reachabilityRejected: 0,
  lexicalSlotVisits: 0,
  punctuationSlotVisits: 0,
  allCompatibleProfiles: 0,
  bindingFilterCalls: 0,
  bindingFilterVisits: 0,
  bindingFilterKeptProfiles: 0,
  selectedIndexSearches: 0,
  selectedIndexVisits: 0,
  selectedIndexFoundPositionTotal: 0,
  punctuationPathCalls: 0,
  punctuationPathVisits: 0,
  realizedEntryMapVisits: 0,
};

export function readFormalSyntaxLoopAttribution() {
  return { ...FORMAL_LOOP_ATTRIBUTION };
}
'''
if old not in text:
    raise SystemExit("stats anchor missing")
text = text.replace(old, new, 1)

old = '''function weightedIndex(
  weights: readonly number[],
  random: RandomSource,
): number | null {
  if (weights.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("formal syntax entry weights must be finite and non-negative");
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  let target = nextUnit(random) * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= weights[index] ?? 0;
    if (target < 0) return index;
  }
  return weights.length - 1;
}
'''
new = '''function weightedIndex(
  weights: readonly number[],
  random: RandomSource,
): number | null {
  FORMAL_LOOP_ATTRIBUTION.weightedIndexCalls += 1;
  if (weights.some((value) => {
    FORMAL_LOOP_ATTRIBUTION.weightedValidationVisits += 1;
    return !Number.isFinite(value) || value < 0;
  })) {
    throw new Error("formal syntax entry weights must be finite and non-negative");
  }
  const total = weights.reduce((sum, value) => {
    FORMAL_LOOP_ATTRIBUTION.weightedReduceVisits += 1;
    return sum + value;
  }, 0);
  if (!(total > 0)) {
    FORMAL_LOOP_ATTRIBUTION.weightedZeroTotals += 1;
    return null;
  }
  let target = nextUnit(random) * total;
  for (let index = 0; index < weights.length; index += 1) {
    FORMAL_LOOP_ATTRIBUTION.weightedSelectionLoopVisits += 1;
    target -= weights[index] ?? 0;
    if (target < 0) return index;
  }
  return weights.length - 1;
}
'''
if old not in text:
    raise SystemExit("weightedIndex anchor missing")
text = text.replace(old, new, 1)

old = '''function groupedCompatibleProfiles(
  compatible: readonly RuntimeSyntaxProfile[],
): readonly CompatibleProfileGroup[] {
  const cached = compatibleProfileGroupsCache.get(compatible);
  if (cached !== undefined) return cached;
'''
new = '''function groupedCompatibleProfiles(
  compatible: readonly RuntimeSyntaxProfile[],
): readonly CompatibleProfileGroup[] {
  FORMAL_LOOP_ATTRIBUTION.groupedCalls += 1;
  FORMAL_LOOP_ATTRIBUTION.groupedSourceProfiles += compatible.length;
  const cached = compatibleProfileGroupsCache.get(compatible);
  if (cached !== undefined) {
    FORMAL_LOOP_ATTRIBUTION.groupedCacheHits += 1;
    return cached;
  }
  FORMAL_LOOP_ATTRIBUTION.groupedCacheMisses += 1;
'''
if old not in text:
    raise SystemExit("grouped anchor missing")
text = text.replace(old, new, 1)

old = '''  const groups = [...profilesByEntryId].map(([entryId, profiles]) => ({
    entryId,
    profiles,
  }));
  compatibleProfileGroupsCache.set(compatible, groups);
'''
new = '''  const groups = [...profilesByEntryId].map(([entryId, profiles]) => ({
    entryId,
    profiles,
  }));
  FORMAL_LOOP_ATTRIBUTION.groupedBuiltGroups += groups.length;
  compatibleProfileGroupsCache.set(compatible, groups);
'''
if old not in text:
    raise SystemExit("groups build anchor missing")
text = text.replace(old, new, 1)

old = '''): RuntimeSyntaxProfile | null {
  const eligibleGroups = groupedCompatibleProfiles(compatible).filter((group) =>
  !usedEntryIds.has(group.entryId) || group.entryId === reusableEntryId
);
  const selectedEntryIndex = weightedIndex(eligibleGroups.map((group) => {
    const entry = entriesById.get(group.entryId);
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
    const baseWeight = entryWeight?.(entry)
      ?? entryWeightsById?.[entry.id]
      ?? defaultEntryWeight(entry);
    if (previousEntry === null || lexicalCompatibility === undefined) return baseWeight;
    const score = surfaceCompatibilityScore(
'''
new = '''): RuntimeSyntaxProfile | null {
  FORMAL_LOOP_ATTRIBUTION.selectCalls += 1;
  const sourceGroups = groupedCompatibleProfiles(compatible);
  FORMAL_LOOP_ATTRIBUTION.sourceGroups += sourceGroups.length;
  const eligibleGroups = sourceGroups.filter((group) => {
    FORMAL_LOOP_ATTRIBUTION.groupFilterVisits += 1;
    const eligible = !usedEntryIds.has(group.entryId) || group.entryId === reusableEntryId;
    if (!eligible) FORMAL_LOOP_ATTRIBUTION.groupsFilteredByReuse += 1;
    return eligible;
  });
  FORMAL_LOOP_ATTRIBUTION.eligibleGroups += eligibleGroups.length;
  const selectedEntryIndex = weightedIndex(eligibleGroups.map((group) => {
    FORMAL_LOOP_ATTRIBUTION.groupWeightVisits += 1;
    const entry = entriesById.get(group.entryId);
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
    let baseWeight: number;
    if (entryWeight !== undefined) {
      FORMAL_LOOP_ATTRIBUTION.dynamicEntryWeightUses += 1;
      baseWeight = entryWeight(entry);
    } else {
      const mappedWeight = entryWeightsById?.[entry.id];
      if (mappedWeight !== undefined) {
        FORMAL_LOOP_ATTRIBUTION.mappedEntryWeightUses += 1;
        baseWeight = mappedWeight;
      } else {
        FORMAL_LOOP_ATTRIBUTION.defaultEntryWeightUses += 1;
        baseWeight = defaultEntryWeight(entry);
      }
    }
    if (previousEntry === null || lexicalCompatibility === undefined) return baseWeight;
    FORMAL_LOOP_ATTRIBUTION.surfaceCompatibilityCalls += 1;
    const score = surfaceCompatibilityScore(
'''
if old not in text:
    raise SystemExit("select anchor missing")
text = text.replace(old, new, 1)

old = '''  const entryProfiles = selectedGroup.profiles;
  if (entryProfiles.length === 0) throw new Error("formal syntax profile group is empty");
  const selectedProfileIndex = entryProfiles.length === 1
    ? 0
    : Math.floor(nextUnit(random) * entryProfiles.length);
'''
new = '''  const entryProfiles = selectedGroup.profiles;
  FORMAL_LOOP_ATTRIBUTION.selectedGroupProfiles += entryProfiles.length;
  if (entryProfiles.length === 0) throw new Error("formal syntax profile group is empty");
  if (entryProfiles.length === 1) FORMAL_LOOP_ATTRIBUTION.selectedSingletonProfileGroups += 1;
  else FORMAL_LOOP_ATTRIBUTION.selectedMultiProfileGroups += 1;
  const selectedProfileIndex = entryProfiles.length === 1
    ? 0
    : (FORMAL_LOOP_ATTRIBUTION.selectedProfileRandomDraws += 1,
      Math.floor(nextUnit(random) * entryProfiles.length));
'''
if old not in text:
    raise SystemExit("profile group anchor missing")
text = text.replace(old, new, 1)

old = '''function punctuationForPath(path: readonly string[]): "。" | "！" | "？" {
  if (path.some((id) => id.includes("question"))) return "？";
'''
new = '''function punctuationForPath(path: readonly string[]): "。" | "！" | "？" {
  FORMAL_LOOP_ATTRIBUTION.punctuationPathCalls += 1;
  if (path.some((id) => {
    FORMAL_LOOP_ATTRIBUTION.punctuationPathVisits += 1;
    return id.includes("question");
  })) return "？";
'''
if old not in text:
    raise SystemExit("punctuation anchor missing")
text = text.replace(old, new, 1)

old = '''function sameCanonicalRuleSet(
  rules: readonly ProductionRule[],
  canonicalRules: readonly ProductionRule[],
): boolean {
  if (rules.length !== canonicalRules.length) return false;
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  if (byId.size !== rules.length) return false;
  return canonicalRules.every((canonicalRule) => {
    const candidate = byId.get(canonicalRule.id);
    return candidate !== undefined && JSON.stringify(candidate) === JSON.stringify(canonicalRule);
  });
}
'''
new = '''function sameCanonicalRuleSet(
  rules: readonly ProductionRule[],
  canonicalRules: readonly ProductionRule[],
): boolean {
  FORMAL_LOOP_ATTRIBUTION.sameCanonicalCalls += 1;
  if (rules.length !== canonicalRules.length) return false;
  const byId = new Map(rules.map((rule) => {
    FORMAL_LOOP_ATTRIBUTION.sameCanonicalRuleMapVisits += 1;
    return [rule.id, rule];
  }));
  if (byId.size !== rules.length) return false;
  return canonicalRules.every((canonicalRule) => {
    FORMAL_LOOP_ATTRIBUTION.sameCanonicalEveryVisits += 1;
    const candidate = byId.get(canonicalRule.id);
    if (candidate === undefined) return false;
    FORMAL_LOOP_ATTRIBUTION.sameCanonicalJsonStringifies += 2;
    return JSON.stringify(candidate) === JSON.stringify(canonicalRule);
  });
}
'''
if old not in text:
    raise SystemExit("same canonical anchor missing")
text = text.replace(old, new, 1)

old = '''): GrammarCompositionResult {
  if (!Number.isInteger(input.maximumCandidates) || input.maximumCandidates <= 0) {
'''
new = '''): GrammarCompositionResult {
  FORMAL_LOOP_ATTRIBUTION.composeCalls += 1;
  if (!Number.isInteger(input.maximumCandidates) || input.maximumCandidates <= 0) {
'''
if old not in text:
    raise SystemExit("compose anchor missing")
text = text.replace(old, new, 1)

old = '''  const sentenceRules = useProductFamilyPolicy
    ? rules.filter((rule) => rule.output === "Sentence")
    : [];
'''
new = '''  const sentenceRules = useProductFamilyPolicy
    ? rules.filter((rule) => {
        FORMAL_LOOP_ATTRIBUTION.sentenceRuleFilterVisits += 1;
        const keep = rule.output === "Sentence";
        if (keep) FORMAL_LOOP_ATTRIBUTION.sentenceRulesKept += 1;
        return keep;
      })
    : [];
'''
if old not in text:
    raise SystemExit("sentence rules anchor missing")
text = text.replace(old, new, 1)

old = '''      isLexicalSlotReachable: (slot) => {
        if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
        return compatibleProfilesForSlot(slot, index).length > 0;
      },
'''
new = '''      isLexicalSlotReachable: (slot) => {
        FORMAL_LOOP_ATTRIBUTION.reachabilityCalls += 1;
        if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") {
          FORMAL_LOOP_ATTRIBUTION.reachabilityPunctuationFastPath += 1;
          return true;
        }
        const reachableProfiles = compatibleProfilesForSlot(slot, index);
        FORMAL_LOOP_ATTRIBUTION.reachabilityCompatibleProfileItems += reachableProfiles.length;
        const reachable = reachableProfiles.length > 0;
        if (reachable) FORMAL_LOOP_ATTRIBUTION.reachabilityCompatible += 1;
        else FORMAL_LOOP_ATTRIBUTION.reachabilityRejected += 1;
        return reachable;
      },
'''
if old not in text:
    raise SystemExit("reachability anchor missing")
text = text.replace(old, new, 1)

old = '''    for (const slot of shape.lexicalSlots) {
      if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") {
        previousEntry = null;
        continue;
      }
'''
new = '''    for (const slot of shape.lexicalSlots) {
      FORMAL_LOOP_ATTRIBUTION.lexicalSlotVisits += 1;
      if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") {
        FORMAL_LOOP_ATTRIBUTION.punctuationSlotVisits += 1;
        previousEntry = null;
        continue;
      }
'''
if old not in text:
    raise SystemExit("slot loop anchor missing")
text = text.replace(old, new, 1)

old = '''      const allCompatible = compatibleProfilesForSlot(slot, index);
      const boundEntryId = slot.entryBindingId === undefined
        ? undefined
        : entryIdByBinding.get(slot.entryBindingId);
      const compatible = boundEntryId === undefined
        ? allCompatible
        : allCompatible.filter((profile) => profile.entryId === boundEntryId);
'''
new = '''      const allCompatible = compatibleProfilesForSlot(slot, index);
      FORMAL_LOOP_ATTRIBUTION.allCompatibleProfiles += allCompatible.length;
      const boundEntryId = slot.entryBindingId === undefined
        ? undefined
        : entryIdByBinding.get(slot.entryBindingId);
      if (boundEntryId !== undefined) FORMAL_LOOP_ATTRIBUTION.bindingFilterCalls += 1;
      const compatible = boundEntryId === undefined
        ? allCompatible
        : allCompatible.filter((profile) => {
            FORMAL_LOOP_ATTRIBUTION.bindingFilterVisits += 1;
            const keep = profile.entryId === boundEntryId;
            if (keep) FORMAL_LOOP_ATTRIBUTION.bindingFilterKeptProfiles += 1;
            return keep;
          });
'''
if old not in text:
    raise SystemExit("compatible anchor missing")
text = text.replace(old, new, 1)

old = '''      const selectedIndex = allCompatible.findIndex((profile) => profile.id === selectedProfile.id);
      if (selectedIndex < 0) throw new Error("formal syntax compatible profile selection failed");
'''
new = '''      FORMAL_LOOP_ATTRIBUTION.selectedIndexSearches += 1;
      const selectedIndex = allCompatible.findIndex((profile) => {
        FORMAL_LOOP_ATTRIBUTION.selectedIndexVisits += 1;
        return profile.id === selectedProfile.id;
      });
      if (selectedIndex < 0) throw new Error("formal syntax compatible profile selection failed");
      FORMAL_LOOP_ATTRIBUTION.selectedIndexFoundPositionTotal += selectedIndex + 1;
'''
if old not in text:
    raise SystemExit("findIndex anchor missing")
text = text.replace(old, new, 1)

old = '''    const entries = realization.entryIds.map((entryId) => {
      const entry = entriesById.get(entryId);
'''
new = '''    const entries = realization.entryIds.map((entryId) => {
      FORMAL_LOOP_ATTRIBUTION.realizedEntryMapVisits += 1;
      const entry = entriesById.get(entryId);
'''
if old not in text:
    raise SystemExit("entry map anchor missing")
text = text.replace(old, new, 1)

path.write_text(text)

Path(".tmp-post296-formal-loop-attribution.ts").write_text(r'''import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "./src/app/generated/catalog.js";
import { readFormalSyntaxLoopAttribution } from "./src/curriculum/formal-syntax-utterance.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "./src/product/session.js";

const sampleCount = Number(process.env.SAMPLE_COUNT);
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post296-formal-loop-attribution",
  "guided",
  "standard",
);
let attemptTotal = 0;
for (let round = 0; round < sampleCount; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  attemptTotal += state.round.selection.generationAttempts;
}
const stats = readFormalSyntaxLoopAttribution();
const ratio = (a: number, b: number) => b === 0 ? 0 : Number((a / b * 100).toFixed(2));
const avg = (a: number, b: number) => b === 0 ? 0 : Number((a / b).toFixed(2));
console.log(JSON.stringify({
  target: process.env.TARGET_REF,
  sampleCount,
  attemptTotal,
  stats,
  derived: {
    composeCallsPerRound: avg(stats.composeCalls, sampleCount),
    sameCanonicalCallsPerCompose: avg(stats.sameCanonicalCalls, stats.composeCalls),
    sameCanonicalEveryVisitsPerCompose: avg(stats.sameCanonicalEveryVisits, stats.composeCalls),
    sameCanonicalJsonStringifiesPerCompose: avg(stats.sameCanonicalJsonStringifies, stats.composeCalls),
    sentenceRuleFilterVisitsPerCompose: avg(stats.sentenceRuleFilterVisits, stats.composeCalls),
    groupedCacheHitPct: ratio(stats.groupedCacheHits, stats.groupedCalls),
    avgSourceGroupsPerSelect: avg(stats.sourceGroups, stats.selectCalls),
    reuseFilterPct: ratio(stats.groupsFilteredByReuse, stats.groupFilterVisits),
    avgEligibleGroupsPerSelect: avg(stats.eligibleGroups, stats.selectCalls),
    defaultWeightPct: ratio(stats.defaultEntryWeightUses, stats.groupWeightVisits),
    dynamicWeightPct: ratio(stats.dynamicEntryWeightUses, stats.groupWeightVisits),
    mappedWeightPct: ratio(stats.mappedEntryWeightUses, stats.groupWeightVisits),
    surfaceCompatibilityPct: ratio(stats.surfaceCompatibilityCalls, stats.groupWeightVisits),
    validationVisitsPerWeightedIndex: avg(stats.weightedValidationVisits, stats.weightedIndexCalls),
    reduceVisitsPerWeightedIndex: avg(stats.weightedReduceVisits, stats.weightedIndexCalls),
    selectionLoopVisitsPerWeightedIndex: avg(stats.weightedSelectionLoopVisits, stats.weightedIndexCalls),
    selectedSingletonProfileGroupPct: ratio(stats.selectedSingletonProfileGroups, stats.selectCalls),
    selectedProfileRandomDrawPct: ratio(stats.selectedProfileRandomDraws, stats.selectCalls),
    reachabilityRejectPct: ratio(
      stats.reachabilityRejected,
      stats.reachabilityCalls - stats.reachabilityPunctuationFastPath,
    ),
    avgReachabilityCompatibleProfiles: avg(
      stats.reachabilityCompatibleProfileItems,
      stats.reachabilityCalls - stats.reachabilityPunctuationFastPath,
    ),
    avgAllCompatibleProfilesPerLexicalSlot: avg(
      stats.allCompatibleProfiles,
      stats.lexicalSlotVisits - stats.punctuationSlotVisits,
    ),
    bindingFilterPctOfLexicalSlots: ratio(stats.bindingFilterCalls, stats.lexicalSlotVisits),
    avgBindingFilterVisits: avg(stats.bindingFilterVisits, stats.bindingFilterCalls),
    avgFindIndexVisits: avg(stats.selectedIndexVisits, stats.selectedIndexSearches),
    avgSelectedIndexPosition: avg(stats.selectedIndexFoundPositionTotal, stats.selectedIndexSearches),
    avgPunctuationPathVisits: avg(stats.punctuationPathVisits, stats.punctuationPathCalls),
  },
}, null, 2));
''')
