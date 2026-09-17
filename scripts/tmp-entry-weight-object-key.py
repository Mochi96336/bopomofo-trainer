from pathlib import Path

path = Path("src/curriculum/frequency-first-utterance.ts")
text = path.read_text()
old = '''  const entryWeights = new Map<string, number>();
  const entryWeight = (entry: CatalogEntry): number => {
    const existing = entryWeights.get(entry.id);
    if (existing !== undefined) return existing;
    const weight = input.profiles !== undefined && input.legacyTransitions === null
      ? bindingOnlyFormalEntryTotalWeight(entry, input, hasBindingEvidence)
      : scoreEntry(entry, input).totalWeight;
    entryWeights.set(entry.id, weight);
    return weight;
  };
'''
new = '''  const entryWeights = new Map<CatalogEntry, number>();
  const entryWeight = (entry: CatalogEntry): number => {
    const existing = entryWeights.get(entry);
    if (existing !== undefined) return existing;
    const weight = input.profiles !== undefined && input.legacyTransitions === null
      ? bindingOnlyFormalEntryTotalWeight(entry, input, hasBindingEvidence)
      : scoreEntry(entry, input).totalWeight;
    entryWeights.set(entry, weight);
    return weight;
  };
'''
if text.count(old) != 1:
    raise SystemExit(f"expected exactly one entry-weight cache block, found {text.count(old)}")
path.write_text(text.replace(old, new))
