# Word + oracle-UPOS: how much genuine disambiguation exists?

This independent Draft follows the 18 pinned actual UD Chinese GSD
contexts from #433. It asks a sharper question: **if we give the
current shipping catalog the original *whole written word* and its
corpus UPOS tag, can the *current* reviewed role-based reading license
uniquely determine the correct target-character Zhuyin?**

Only after the candidate set has been computed do we consult the
separately recorded MOE target reading to classify the result.

## How to run

```sh
npm ci --include=dev --ignore-scripts
npm run app:catalog
npx vitest run tests/readings/attested-gold-blind-diagnostic.test.ts
npx tsx scripts/audit-attested-gold-blind-reading.ts \
  research/attested-reading-pilot/cases.json \
  data/generated/attested-gold-blind-diagnostic.json
```

For each row:
1. Look up **exact** attested word form from UD (not a rewritten
   natural-sounding sample sentence).
2. Keep catalog identities with the same number of syllables.
3. Join the existing runtime syntax profiles by **UD UPOS**. This is
   **oracle metadata**, not a POS prediction by the product.
4. Apply only the current shipping `reviewedRoleReadingEligible`
   policy and deduplicate exact target-character Zhuyin sequences.
5. Record whether exactly one reading remains, multiple readings
   remain, or no compatible candidate is possible.
6. **Only after step 5**, compare with the independently reviewed
   target pronunciation in `cases.json`.

The status `unique-matches-reviewed-gold` means **unique given
correctly supplied source token + UD UPOS**; it is **not** natural
full-sentence G2P accuracy. `ambiguous-includes-reviewed-gold` is a
*failure to decide*, not success. A target with no compatible profile
is *unsupported*, not an incorrect G2P prediction.

Tested reading is **one target character** per natural original
sentence. This does not label complete sentence syllables.

## Why this is necessary

The earlier exact-word availability audit on 18 real contexts found:
- 15 with the reviewed reading and no other aligned pronunciation in
  the *same written word*;
- 3 with multiple catalog pronunciations despite including the gold:
  `兩種`, `給行為分析`, `交工資給叔父`.

The follow-up must investigate whether *existing grammatical evidence
alone* disambiguates these cases, or whether following-word and
full-clause semantic context is actually needed.

Critically, the old generation sampler **does not take an existing
natural sentence as input**. This is a candidate diagnostic — it
cannot be presented as a working natural-context model. No formal
grammar, catalog or production selector is modified.

**Keep Draft; do not merge automatically or treat the raw rate as
production reading accuracy.**
