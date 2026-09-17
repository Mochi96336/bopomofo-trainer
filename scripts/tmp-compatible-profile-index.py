from pathlib import Path

path = Path("src/curriculum/formal-syntax-utterance.ts")
text = path.read_text()

anchor = '''function groupedCompatibleProfiles(
  compatible: readonly RuntimeSyntaxProfile[],
): readonly CompatibleProfileGroup[] {
  const cached = compatibleProfileGroupsCache.get(compatible);
  if (cached !== undefined) return cached;
  const profilesByEntryId = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of compatible) {
    const profiles = profilesByEntryId.get(profile.entryId) ?? [];
    profiles.push(profile);
    profilesByEntryId.set(profile.entryId, profiles);
  }
  const groups = [...profilesByEntryId].map(([entryId, profiles]) => ({
    entryId,
    profiles,
  }));
  compatibleProfileGroupsCache.set(compatible, groups);
  return groups;
}
'''
insert = anchor + '''
const compatibleProfileFirstIndexCache = new WeakMap<
  readonly RuntimeSyntaxProfile[],
  ReadonlyMap<string, number>
>();

function compatibleProfileFirstIndex(
  compatible: readonly RuntimeSyntaxProfile[],
  profileId: string,
): number {
  let firstIndexById = compatibleProfileFirstIndexCache.get(compatible);
  if (firstIndexById === undefined) {
    const built = new Map<string, number>();
    for (let index = 0; index < compatible.length; index += 1) {
      const id = compatible[index]?.id;
      if (id !== undefined && !built.has(id)) built.set(id, index);
    }
    firstIndexById = built;
    compatibleProfileFirstIndexCache.set(compatible, firstIndexById);
  }
  return firstIndexById.get(profileId) ?? -1;
}
'''
if text.count(anchor) != 1:
    raise SystemExit(f"expected groupedCompatibleProfiles anchor once, found {text.count(anchor)}")
text = text.replace(anchor, insert)
old = '''      const selectedIndex = allCompatible.findIndex((profile) => profile.id === selectedProfile.id);
'''
new = '''      const selectedIndex = compatibleProfileFirstIndex(allCompatible, selectedProfile.id);
'''
if text.count(old) != 1:
    raise SystemExit(f"expected selectedIndex findIndex once, found {text.count(old)}")
text = text.replace(old, new)
path.write_text(text)
