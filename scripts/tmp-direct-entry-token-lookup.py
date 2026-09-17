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
): number {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  const prepared = input.preparedFrequencyFirstEntries;
  const tokenIds = prepared === undefined
    ? scoringTokens([entry], input)
    : prepared.tokenIdsByEntryId.get(entry.id);
  if (tokenIds === undefined) {
    throw new Error(`prepared frequency-first entry disappeared: ${entry.id}`);
  }
  for (const tokenId of tokenIds) {
    expectedTokenBoost = Math.max(
      expectedTokenBoost,
      expectedTokenTraceForToken(tokenId, input).boost,
    );
  }
'''
if old not in s:
    raise SystemExit("bindingOnlyFormalEntryTotalWeight anchor missing")
p.write_text(s.replace(old, new, 1))
