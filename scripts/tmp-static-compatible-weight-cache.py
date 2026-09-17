from pathlib import Path

path = Path("src/curriculum/formal-syntax-utterance.ts")
text = path.read_text()

marker = "\nfunction selectCompatibleProfile(\n"
helper = r'''

interface StaticCompatibleProfileWeights {
  readonly groups: readonly CompatibleProfileGroup[];
  readonly weights: readonly number[];
  readonly totalWeight: number;
}

const compatibleProfileGroupIndexCache = new WeakMap<
  readonly RuntimeSyntaxProfile[],
  ReadonlyMap<string, number>
>();

const staticCompatibleProfileWeightsCache = new WeakMap<
  readonly RuntimeSyntaxProfile[],
  WeakMap<ReadonlyMap<string, CatalogEntry>, StaticCompatibleProfileWeights>
>();

function compatibleProfileGroupIndex(
  compatible: readonly RuntimeSyntaxProfile[],
): ReadonlyMap<string, number> {
  const cached = compatibleProfileGroupIndexCache.get(compatible);
  if (cached !== undefined) return cached;
  const groups = groupedCompatibleProfiles(compatible);
  const index = new Map<string, number>();
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    index.set(groups[groupIndex]!.entryId, groupIndex);
  }
  compatibleProfileGroupIndexCache.set(compatible, index);
  return index;
}

function preparedStaticCompatibleProfileWeights(
  compatible: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
): StaticCompatibleProfileWeights {
  let byEntries = staticCompatibleProfileWeightsCache.get(compatible);
  if (byEntries === undefined) {
    byEntries = new WeakMap<ReadonlyMap<string, CatalogEntry>, StaticCompatibleProfileWeights>();
    staticCompatibleProfileWeightsCache.set(compatible, byEntries);
  }
  const cached = byEntries.get(entriesById);
  if (cached !== undefined) return cached;

  const groups = groupedCompatibleProfiles(compatible);
  const weights = new Array<number>(groups.length);
  let totalWeight = 0;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const entry = entriesById.get(group.entryId);
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
    const weight = defaultEntryWeight(entry);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("formal syntax entry weights must be finite and non-negative");
    }
    weights[index] = weight;
    totalWeight += weight;
  }
  const prepared = { groups, weights, totalWeight };
  byEntries.set(entriesById, prepared);
  return prepared;
}
'''
assert marker in text
text = text.replace(marker, helper + marker, 1)

needle = '''  const groups = groupedCompatibleProfiles(compatible);\n  const weights = new Array<number>(groups.length);\n'''
replacement = '''  const useStaticDefaultWeights = entryWeight === undefined\n    && entryWeightsById === undefined\n    && (previousEntry === null || lexicalCompatibility === undefined);\n  if (useStaticDefaultWeights) {\n    const groupIndexByEntryId = compatibleProfileGroupIndex(compatible);\n    let hasExcludedCompatibleEntry = false;\n    for (const entryId of usedEntryIds) {\n      if (entryId !== reusableEntryId && groupIndexByEntryId.has(entryId)) {\n        hasExcludedCompatibleEntry = true;\n        break;\n      }\n    }\n    if (!hasExcludedCompatibleEntry) {\n      const prepared = preparedStaticCompatibleProfileWeights(compatible, entriesById);\n      if (!(prepared.totalWeight > 0)) return null;\n      let target = nextUnit(random) * prepared.totalWeight;\n      let selectedGroup: CompatibleProfileGroup | undefined;\n      for (let index = 0; index < prepared.groups.length; index += 1) {\n        target -= prepared.weights[index] ?? 0;\n        if (target < 0) {\n          selectedGroup = prepared.groups[index];\n          break;\n        }\n      }\n      selectedGroup ??= prepared.groups[prepared.groups.length - 1];\n      if (selectedGroup === undefined) throw new Error("formal syntax entry selection failed");\n      const entryProfiles = selectedGroup.profiles;\n      if (entryProfiles.length === 0) throw new Error("formal syntax profile group is empty");\n      const selectedProfileIndex = entryProfiles.length === 1\n        ? 0\n        : Math.floor(nextUnit(random) * entryProfiles.length);\n      return entryProfiles[selectedProfileIndex] ?? null;\n    }\n  }\n\n  const groups = groupedCompatibleProfiles(compatible);\n  const weights = new Array<number>(groups.length);\n'''
select_start = text.index("function selectCompatibleProfile(")
prefix = text[:select_start]
suffix = text[select_start:]
assert needle in suffix
suffix = suffix.replace(needle, replacement, 1)
text = prefix + suffix
path.write_text(text)
