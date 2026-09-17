from pathlib import Path

path = Path("src/curriculum/frequency-first-utterance.ts")
text = path.read_text()

old = '''  const hasBindingEvidence = Object.keys(input.bindingsByToken).length !== 0;
  const entryWeights = new Map<string, number>();
'''
new = '''  const hasBindingEvidence = Object.keys(input.bindingsByToken).length !== 0;
  const useStaticFormalEntryWeight = input.profiles !== undefined
    && input.legacyTransitions === null
    && !hasBindingEvidence
    && input.history.recentEntryIds.length === 0;
  const entryWeights = new Map<string, number>();
'''
if text.count(old) != 1:
    raise SystemExit(f"expected evidence/cache anchor once, found {text.count(old)}")
text = text.replace(old, new)

old = '''      entryWeight,
      minimumLexicalEntries: 2,
'''
new = '''      ...(useStaticFormalEntryWeight ? {} : { entryWeight }),
      minimumLexicalEntries: 2,
'''
if text.count(old) != 1:
    raise SystemExit(f"expected formal composer entryWeight field once, found {text.count(old)}")
text = text.replace(old, new)

path.write_text(text)
