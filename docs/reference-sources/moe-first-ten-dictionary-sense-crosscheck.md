# Cross-check of the first ten reading identities against MOE public sense entries

This extends #412. The ten target pronunciations were already verified against
two SHA-pinned **September 2026 MOE bulk dictionaries** in #410. The new
`moe-online-headword-sense-evidence.json` adds **independent public MOE
Concised Dictionary online 2021 reference URLs** and a short, independently
authored sense-family label for each identity.

**This does not mark the September source definitions or any example sentence
as reviewed.** The online 2021 website and September 2026 bulk versions must
not be silently treated as identical. Keep their provenance separate.

## What is now grounded

| Written form | Reading split | Sense-boundary observation |
|---|---|---|
| 種 | ㄓㄨㄥ3 / ㄓㄨㄥ4 | Class/measure versus planting action; grammar roles may resolve clear constructions |
| 說 | ㄕㄨㄛ1 / ㄕㄨㄟ4 | Talking/reporting versus persuasion; compound 遊說 independently attests ㄕㄨㄟ4 |
| 東西 | ㄉㄨㄥ1-ㄒㄧ1 / ㄉㄨㄥ1-ㄒㄧ5 | Direction versus object; **same written lexeme** and coarse NOUN role cannot resolve all cases |
| 給 | ㄍㄟ3 / ㄐㄧ3 | Everyday giving/prepositional use versus supplying and other senses; 自給自足 attests ㄐㄧ3 |
| 為 | ㄨㄟ2 / ㄨㄟ4 | Acting/becoming/predication versus purpose/beneficiary; 成為 attests ㄨㄟ2 |

The URLs in the JSON point to each of the ten MOE online *headword reading*
records, not a potentially rewritten definition or an unverified third-party
corpus.

**Critical lexical boundary:** an attestation that ㄕㄨㄟ4 occurs in 遊說,
ㄐㄧ3 in 自給自足, or ㄨㄟ2 in 成為 is **not** a license to use that reading
for an isolated character in any VERB/AUX slot. A classifier must recognize
the whole lexeme and segmentation or abstain. Nor does the word 東西 become
trivial merely because it has one syntactic tag: disambiguating its two
readings requires which sense the sentence instantiates.

## Remaining gates before runtime

- Privately compare meaning families against the *pinned September 2026*
  definitions, not just the online 2021 entry.
- Adjudicate sentence-level reading and syntactic sense separately, with
  genuine attested contexts and counterexamples.
- For each rule, specify when to **abstain** rather than rejecting unknown
  cases, especially when lexical segmentation is unresolved.
- Retain same-seed stability, reading coverage, tier selection and measured
  browser bundle budget; no new model should be shipped without benchmark
  evidence.

All ten rows deliberately set `usableAsTrainingLabel=false` and
`usableAsProductRule=false`, and their sentence-level reviews remain
`pending`. The test suite enforces these boundaries.
