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

## Measured result on the 18 pinned source occurrences

The first exact-source diagnostic CI succeeded. Existing
**whole-word + oracle UD UPOS + shipping role gate** yielded:

| Outcome | Attested target-character cases |
|---|---:|
| A single candidate equal to independently reviewed MOE target | 15 |
| More than one reading, with the gold among the candidates | **3** |
| A single candidate that conflicts with gold | 0 |
| No licensed candidate under oracle UPOS | 0 |

**This is NOT 15/18 end-to-end context G2P accuracy.** The system was
given gold-quality original word boundaries and UD POS annotations,
neither of which is produced for a new natural sentence by the
current question generator. The three rows left unresolved are:

- `dev-s241` `兩種` (exact standalone `種/NOUN`):
  reviewed `ㄓㄨㄥˇ`; surviving
  `ㄓㄨㄥˇ` **and** `ㄓㄨㄥˋ`.
- `dev-s5` `給行為分析提供` (`給/VERB`):
  reviewed `ㄍㄟˇ`; surviving
  `ㄍㄟˇ` **and** `ㄐㄧˇ`.
- `dev-s287` `交工資給叔父` (`給/VERB`):
  reviewed `ㄍㄟˇ`; surviving
  `ㄍㄟˇ` **and** `ㄐㄧˇ`.

**Next evidence already pinned** in
`unresolved-context-evidence.json`:

- Raw UD `兩/NUM → 種/NOUN` nummod relation, plus ingredient
  phrase, suggests a numeral-class relation for future review.
- Raw UD `給/VERB → 提供/VERB` advcl with `分析` as an
  object suggests a possible beneficiary phrase.
- `交/VERB` modifies `給/VERB` and `叔父` is its object:
  a possible transfer recipient cue.

These are **hypotheses, not proved universal reading rules**.
Source dependency annotations also can be imperfect; an independent
linguistic review or additional contrastive natural contexts are
required before turning any of these patterns into automatic
pronunciation permissions.

A second limitation: the current 18-example set has two naturally
attested `給/ㄍㄟˇ` examples with the **same exact written single
word and POS**, but no contrasting naturally attested standalone
`給/ㄐㄧˇ` in the same comparison set. The already collected
multi-character `給予` and `補給` examples are useful
lexical contrast but cannot by themselves validate *same-word*
context disambiguation.

**Recommendation:** gather true opposing natural contexts of the
*same word + UPOS*, keep a held-out test split, and implement a
context reader only when it can be evaluated without label leakage.
Continue to keep Draft #434 and Draft #433 unmerged.


## Source-integrity gate and gold-free candidate collection

Before the dependency cues are treated as evidence, the diagnostic CI now
checks out an exact upstream UD commit (`22f73e87f7ddc530bb131a6b7587971a03e1a712`)
and independently verifies the Git blob SHA of the original `dev` file.
For all 18 target occurrences, it compares the original sentence, token ID,
form, UPOS, source Translit **as untrusted provenance only**, and recorded
character span. For each of the three ambiguous cases, it additionally checks
every copied UD dependency token's exact HEAD and DEPREL against the original
CoNLL-U. The checker never consults the reviewed pronunciation; unit tests
exercise corpus drift, altered edges, and altered gold annotations.

A second read-only step now mines every **standalone exact-token** occurrence
of `種` and `給` in the pinned `train` split. The JSON artifact preserves
original text, sentence/token identity, original UPOS and dependency fields,
but gives every row `reviewStatus: unlabeled`. Neither UD Translit nor MOE
gold is copied into this review queue. The `dev` and `test` splits contribute
**group counts only**, with no held-out sentence content in the queue.

This is a search for review material, **not** yet a count of examples of
`ㄓㄨㄥˇ/ㄓㄨㄥˋ` or `ㄍㄟˇ/ㄐㄧˇ`. A source annotation or written-form match
must never become a phonetic label without independent contextual review.

### Why the remaining three need different analyses

The MOE dictionary lists `種/ㄓㄨㄥˇ` as noun (including type and classifier
uses), while `種/ㄓㄨㄥˋ` is verbal planting/inoculating. Thus the current
`種/NOUN` ambiguity may reflect an over-permissive catalog role/readings
mapping even *before* building a larger context model. Investigate the two
surviving catalog identities and their syntax profiles; do not assume the
extra fourth-tone candidate is legitimate in this **noun** use.

For `給`, both `ㄍㄟˇ` and `ㄐㄧˇ` have verbal senses in the MOE dictionary.
In actual contemporary transfer/beneficiary uses the reviewed reading is
`ㄍㄟˇ`, but UPOS=VERB alone cannot prove the distinction. A UD `VERB` tag
also does not settle the dictionary's finer verb/preposition distinctions.
The `給` examples therefore call for meaningful semantic/argument contrasts,
not merely an additional POS check.

Dictionary references:
- 種: https://dict.revised.moe.edu.tw/dictView.jsp?ID=8174
- 給: https://dict.revised.moe.edu.tw/dictView.jsp?ID=5423

**Next gate:** review `train` candidates without looking at original Translit
as an answer, document which actually represent independent contrasting
readings, and reserve a separate, genuinely disjoint evaluation split.
If GSD contains no suitable `給/ㄐㄧˇ` standalone comparator, record that
absence instead of constructing or relabeling examples to make the benchmark
look balanced.
