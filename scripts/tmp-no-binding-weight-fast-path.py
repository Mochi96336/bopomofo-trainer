from pathlib import Path

p = Path("src/curriculum/frequency-first-utterance.ts")
s = p.read_text()
old = '''function bindingOnlyFormalEntryTotalWeight(
  entry: CatalogEntry,
  input: FrequencyFirstScoringInput,
): number {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  for (const tokenId of scoringTokens([entry], input)) {
    expectedTokenBoost = Math.max(
      expectedTokenBoost,
      expectedTokenTraceForToken(tokenId, input).boost,
    );
  }
'''
new = '''function bindingOnlyFormalEntryTotalWeight(
  entry: CatalogEntry,
  input: FrequencyFirstScoringInput,
  hasBindingEvidence: boolean,
): number {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  if (hasBindingEvidence) {
    for (const tokenId of scoringTokens([entry], input)) {
      expectedTokenBoost = Math.max(
        expectedTokenBoost,
        expectedTokenTraceForToken(tokenId, input).boost,
      );
    }
  }
'''
if old not in s:
    raise SystemExit("bindingOnlyFormalEntryTotalWeight anchor missing")
s = s.replace(old, new, 1)
old = '''): SlotWeightedGrammarGeneration {
  const entryWeights = new Map<string, number>();
'''
new = '''): SlotWeightedGrammarGeneration {
  const hasBindingEvidence = Object.keys(input.bindingsByToken).length !== 0;
  const entryWeights = new Map<string, number>();
'''
if old not in s:
    raise SystemExit("generateOnce anchor missing")
s = s.replace(old, new, 1)
old = '''      ? bindingOnlyFormalEntryTotalWeight(entry, input)
'''
new = '''      ? bindingOnlyFormalEntryTotalWeight(entry, input, hasBindingEvidence)
'''
if old not in s:
    raise SystemExit("binding-only call anchor missing")
s = s.replace(old, new, 1)
p.write_text(s)
