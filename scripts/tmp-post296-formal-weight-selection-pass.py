from pathlib import Path

p = Path("src/curriculum/formal-syntax-utterance.ts")
s = p.read_text()

weighted_index = '''function weightedIndex(
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
if weighted_index not in s:
    raise SystemExit("weightedIndex helper anchor missing")
s = s.replace(weighted_index, "", 1)

old = '''  const eligibleGroups = groupedCompatibleProfiles(compatible).filter((group) =>
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
      lexicalCompatibility,
      previousEntry.prompt.text,
      entry.prompt.text,
    );
    return baseWeight * lexicalCompatibilityMultiplier(
      score,
      lexicalCompatibilityMaximumBoost,
    );
  }), random);
  if (selectedEntryIndex === null) return null;
  const selectedGroup = eligibleGroups[selectedEntryIndex];
  if (selectedGroup === undefined) throw new Error("formal syntax entry selection failed");
'''
new = '''  const groups = groupedCompatibleProfiles(compatible);
  const weights = new Array<number>(groups.length);
  let totalWeight = 0;
  let lastEligibleGroup: CompatibleProfileGroup | undefined;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    if (usedEntryIds.has(group.entryId) && group.entryId !== reusableEntryId) {
      weights[index] = 0;
      continue;
    }
    lastEligibleGroup = group;
    const entry = entriesById.get(group.entryId);
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
    const baseWeight = entryWeight?.(entry)
      ?? entryWeightsById?.[entry.id]
      ?? defaultEntryWeight(entry);
    const weight = previousEntry === null || lexicalCompatibility === undefined
      ? baseWeight
      : baseWeight * lexicalCompatibilityMultiplier(
          surfaceCompatibilityScore(
            lexicalCompatibility,
            previousEntry.prompt.text,
            entry.prompt.text,
          ),
          lexicalCompatibilityMaximumBoost,
        );
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("formal syntax entry weights must be finite and non-negative");
    }
    weights[index] = weight;
    totalWeight += weight;
  }
  if (!(totalWeight > 0)) return null;
  let target = nextUnit(random) * totalWeight;
  let selectedGroup: CompatibleProfileGroup | undefined;
  for (let index = 0; index < groups.length; index += 1) {
    target -= weights[index] ?? 0;
    if (target < 0) {
      selectedGroup = groups[index];
      break;
    }
  }
  selectedGroup ??= lastEligibleGroup;
  if (selectedGroup === undefined) throw new Error("formal syntax entry selection failed");
'''
if old not in s:
    raise SystemExit("selectCompatibleProfile anchor missing")
p.write_text(s.replace(old, new, 1))
