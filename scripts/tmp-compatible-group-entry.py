from pathlib import Path

path = Path("src/curriculum/formal-syntax-utterance.ts")
text = path.read_text()

replacements = [
    (
'''interface CompatibleProfileGroup {
  readonly entryId: string;
  readonly profiles: readonly RuntimeSyntaxProfile[];
}
''',
'''interface CompatibleProfileGroup {
  readonly entryId: string;
  readonly entry: CatalogEntry | undefined;
  readonly profiles: readonly RuntimeSyntaxProfile[];
}
''',
    ),
    (
'''function groupedCompatibleProfiles(
  compatible: readonly RuntimeSyntaxProfile[],
): readonly CompatibleProfileGroup[] {
''',
'''function groupedCompatibleProfiles(
  compatible: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
): readonly CompatibleProfileGroup[] {
''',
    ),
    (
'''  const groups = [...profilesByEntryId].map(([entryId, profiles]) => ({
    entryId,
    profiles,
  }));
''',
'''  const groups = [...profilesByEntryId].map(([entryId, profiles]) => ({
    entryId,
    entry: entriesById.get(entryId),
    profiles,
  }));
''',
    ),
    (
'''  const eligibleGroups = groupedCompatibleProfiles(compatible).filter((group) =>
''',
'''  const eligibleGroups = groupedCompatibleProfiles(compatible, entriesById).filter((group) =>
''',
    ),
    (
'''  const selectedEntryIndex = weightedIndex(eligibleGroups.map((group) => {
    const entry = entriesById.get(group.entryId);
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
''',
'''  const selectedEntryIndex = weightedIndex(eligibleGroups.map((group) => {
    const entry = group.entry;
    if (entry === undefined) {
      throw new Error(`formal syntax profile references missing entry ${group.entryId}`);
    }
''',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one patch target, found {count}: {old[:80]!r}")
    text = text.replace(old, new)

path.write_text(text)
