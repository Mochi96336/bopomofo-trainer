from pathlib import Path

p = Path("src/curriculum/frequency-first-utterance.ts")
s = p.read_text()

old = '''const expectedTokenTraceCache = new WeakMap<
  FrequencyFirstScoringInput,
  Map<TokenId, ExpectedTokenBoostTrace>
>();

function expectedTokenTraceForToken(
  tokenId: TokenId,
  input: FrequencyFirstScoringInput,
): ExpectedTokenBoostTrace {
  let byToken = expectedTokenTraceCache.get(input);
  if (byToken === undefined) {
    byToken = new Map<TokenId, ExpectedTokenBoostTrace>();
    expectedTokenTraceCache.set(input, byToken);
  }
  const cached = byToken.get(tokenId);
'''
new = '''const expectedTokenTraceCache = new WeakMap<
  FrequencyFirstScoringInput,
  Map<TokenId, ExpectedTokenBoostTrace>
>();

function expectedTokenTraceMap(
  input: FrequencyFirstScoringInput,
): Map<TokenId, ExpectedTokenBoostTrace> {
  let byToken = expectedTokenTraceCache.get(input);
  if (byToken === undefined) {
    byToken = new Map<TokenId, ExpectedTokenBoostTrace>();
    expectedTokenTraceCache.set(input, byToken);
  }
  return byToken;
}

function expectedTokenTraceForToken(
  tokenId: TokenId,
  input: FrequencyFirstScoringInput,
  byToken: Map<TokenId, ExpectedTokenBoostTrace> = expectedTokenTraceMap(input),
): ExpectedTokenBoostTrace {
  const cached = byToken.get(tokenId);
'''
if old not in s:
    raise SystemExit("expected token cache anchor missing")
s = s.replace(old, new, 1)

old = '''  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  for (const tokenId of scoringTokens([entry], input)) {
    expectedTokenBoost = Math.max(
      expectedTokenBoost,
      expectedTokenTraceForToken(tokenId, input).boost,
    );
  }
'''
new = '''  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  const byToken = expectedTokenTraceMap(input);
  for (const tokenId of scoringTokens([entry], input)) {
    expectedTokenBoost = Math.max(
      expectedTokenBoost,
      expectedTokenTraceForToken(tokenId, input, byToken).boost,
    );
  }
'''
if old not in s:
    raise SystemExit("binding-only token loop anchor missing")
s = s.replace(old, new, 1)

p.write_text(s)
