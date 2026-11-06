# MOE reading-role supplement v1

This supplement continues the shipped numeric-fen policy from
`main@22e77571b2b3702d881d2c4c27d2d222c497e08e`. It rejects only eighteen
independently source-checked reading/role combinations. The existing catalog
identities, commonness, learner weights and earlier policy stages stay intact.

## Source review (2026-11-07)

| Selected identity / rejected role | Source-supported distinction | Primary MOE Revised reference |
| --- | --- | --- |
| 爲 / ㄨㄟ4 / AUX | The variant follows 為: copular wéi, not prepositional wèi. Preserve wèi ADP. | [Variant](https://dict.revised.moe.edu.tw/dictView.jsp?ID=160753), [為](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447) |
| 任 / ㄖㄣ2 / VERB | The verb is rèn; rén retains its surname and classical adjective uses. | [任](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9239) |
| 親 / ㄑㄧㄥ4 / ADJ | The independent adjective is qīn. The qìng reading is bound in in-law lexemes; those whole words remain eligible. | [親](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6618), [親家](https://dict.revised.moe.edu.tw/dictView.jsp?ID=102838) |
| 將 / ㄑㄧㄤ1 / ADV | Prospective adverb jiāng differs from the classical request verb qiāng, which remains eligible as VERB. | [將](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6555) |
| 於 / ㄨ1 / ADP | Prepositional yú differs from wū's interjection and historical noun uses. Preserve the rare wū senses. | [於](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11248) |
| 般 / ㄅㄛ1 / ADJ | The standalone adjective is bān. The bō reading belongs to Buddhist whole words. | [般](https://dict.revised.moe.edu.tw/dictView.jsp?ID=712), [般若](https://dict.revised.moe.edu.tw/dictView.jsp?ID=12953) |
| 若 / ㄖㄜ3 / ADP | Bound rě in Buddhist lexemes does not license an independent preposition. Whole-word 般若 and 蘭若 are preserved. | [若](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9201) |
| 遠 / ㄩㄢ4 / ADJ | Distance adjective yuǎn differs from the distancing verb yuàn. VERB and other unreviewed roles remain eligible. | [遠](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11837) |
| 相 / ㄒㄧㄤ4 / ADV | Reciprocal adverb xiāng differs from xiàng's noun and verb senses; preserve both latter roles. | [相](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7228) |
| 中 / ㄓㄨㄥ4 / PART | Verbal zhòng does not license the locative/postposition role carried by this selected PART profile. Locative zhōng remains eligible. | [中](https://dict.revised.moe.edu.tw/dictView.jsp?ID=8171) |
| 石 / ㄉㄢ4 / PROPN | Capacity/weight unit dàn differs from the surname shí. Preserve dàn as a noun/classifier. | [石](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2026) |
| 賈 / ㄍㄨ3 / PROPN | Merchant/trading gǔ differs from surname jiǎ. Preserve gǔ NOUN and VERB. | [賈](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4190) |
| 馮 / ㄆㄧㄥ2 / PROPN | Classical verb/adverb píng differs from surname féng; those rare action/intensity uses remain eligible. | [馮](https://dict.revised.moe.edu.tw/dictView.jsp?ID=977) |
| 合 / ㄍㄜ3 / VERB | Capacity unit gě differs from the independent verb hé. Preserve the exact unit reading and whole-word 公合. | [合](https://dict.revised.moe.edu.tw/dictView.jsp?ID=3968), [公合](https://dict.revised.moe.edu.tw/dictView.jsp?ID=75237) |
| 無 / ㄇㄛ2 / VERB | The bound mó reading in 南無 does not license the independent existence verb wú. Preserve the whole word. | [無](https://dict.revised.moe.edu.tw/dictView.jsp?ID=1047) |
| 彈 / ㄉㄢ4 / VERB | Projectile noun dàn differs from the action tán. The noun reading remains eligible. | [彈](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2045) |
| 只 / ㄓ1 / ADV | For exact written 只, the classifier is zhī and the adverb zhǐ. Separately spelled 祇/祗 have attested zhī adverbs and remain untouched. | [只](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7496), [祇](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7490), [祗](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7494) |
| 足 / ㄐㄩ4 / VERB | Excess adverb jù differs from verbal sufficiency zú. Preserve jù ADV. | [足](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6056) |

These are independently inspected dictionary distinctions, not independent
human adjudication of complete generated sentences. Source UPOS is not a
general sense oracle. For example, MOE also licenses 曾/ㄗㄥ1 as an adverb,
那/ㄋㄨㄛ2 as a classical pronoun, and 行/ㄒㄧㄥ2 as a noun/classifier.
The supplement intentionally leaves those rare readings untouched.
The same source review confirms [頡/ㄒㄧㄝ2](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6949)
and [哈/ㄏㄚ1](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4723) as surnames,
and [作/ㄗㄨㄛ1](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9632) as a
verb. Explicit preservation tests prevent their rejection based on an assumed
more-common pronunciation.

## Paired product-family evidence

The 2,048-seed pre-supplement replay is byte-identical to the exact-head #461
CI final numeric-fen population: SHA-256
`f3588ecf8d9078981b32e9c0656f84d840ab26ab8b567d73f0ae645e36bceb51`.
The independently frozen source slots are in `FROZEN_SUPPLEMENT_BAD_SLOTS`.

Local before/after comparison:

- 2,048 / 2,048 generation successes in each population;
- twenty-two reviewed reading/role mismatches before, zero after;
- twenty-two changed seeds, each with exactly one changed lexical slot;
- no root, lexical-count or unrelated lexical/text drift;
- nineteen fewer polyphonic selected occurrences (962 → 943).

All twenty-two replacements select a different written word. This is removal of
unsupported reading/role candidates, **not twenty-two same-word pronunciation
corrections**, and not an overall pronunciation-accuracy estimate. Valid
alternatives keep their own learner/frequency weights through the existing
slot-local redraw; invalid candidates cannot transfer their weights to a
same-written-word reading.

Reproduce:

```sh
npm run app:catalog
npx tsx scripts/audit-polyphonic-context.ts --policy standard-numeric-fen-trial --output data/generated/polyphonic-role-supplement-before.json
npx tsx scripts/audit-polyphonic-context.ts --policy standard-role-supplement-trial --output data/generated/polyphonic-role-supplement-after.json
npx tsx scripts/compare-moe-role-supplement.ts data/generated/polyphonic-role-supplement-before.json data/generated/polyphonic-role-supplement-after.json data/generated/polyphonic-role-supplement-comparison.json
```

Focused tests cover the source distinctions, legitimate rare readings,
whole-word preservation, stale populations, missed repairs and collateral
changes. The actual product-session test also applies the supplement in fresh
rounds and 24 fixed seeds in each commonness tier. Broader syntax, sentence naturalness,
and uncertain contextual readings are outside this correction.

Final local validation: `npm run check:pr` passed (241 Vitest files / 1,304
tests, 76 Python tests, typecheck, catalog validation, build and bundle budget).
`npx playwright test` against that production build passed all 62 Chromium
tests. JS gzip is 481.03 kB, within the unchanged 500,000-byte budget.

The final after-population SHA-256 is
`1477628e7828146cd268c983ef4c9b40961b8c6391c4d41aa2e6a1a43d653e40`;
the comparison SHA-256 is
`ff121ac797b43815405464187503dbd1686d1b81aa7091b2ba47d30566367269`.
Reports remain reproducible ignored artifacts, rather than committed payloads.

## Follow-up queue

The final population still has unreviewed cases. Start the next review from the
actual after-report, not the pre-supplement source or the set of removed IDs.
One concrete lead is seed 473's independent `為/ㄨㄟ4/PROPN`: the MOE 為
entry above lists its surname under ㄨㄟ2. Confirm the actual selected profile
and its preservation cases before adding any restriction. Other rare or
grammatically anomalous slots need separate evidence; do not infer their
pronunciation from a desired common reading or sentence naturalness.
