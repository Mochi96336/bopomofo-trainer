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

## Follow-up: surname 為 and adverbial 好

Reviewed against the actual v1 after-population at `a2de4f5`, not the earlier
numeric-fen population. The exact selected source cases are:

| Seed / lexical slot | Exact selected reading / role | Source distinction |
| --- | --- | --- |
| 473 / 0 | `word:為:ㄨㄟ4`, PROPN, `runtime-syntax-profile:14080` | [MOE 為](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447) lists the independent surname under wéi. Wèi retains independently attested prepositional, verbal and adverbial uses; none of those roles is rejected. |
| 1354 / 3 | `word:好:ㄏㄠ4`, ADV, `runtime-syntax-profile:15422` | [MOE 好](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4814) assigns the degree, ease and purpose adverbs to hǎo. Hào's liking verb and nominal senses, including a jade aperture, remain eligible. Exact whole-word entries such as 愛好 and 好學 are unchanged. |

The follow-up is a separate ordered redraw stage. Editing the original v1
frontier would also alter candidate weights during some v1 repairs; that would
reopen already-reviewed replacements merely to fix these two later cases.
Both the v1 and follow-up comparisons reuse the same strict comparison engine,
with separate frozen targets and source/after-policy identities.

Source review also confirmed that [解/ㄐㄧㄝ4](https://dict.revised.moe.edu.tw/dictView.jsp?ID=5627)
has a historical government-office NOUN sense. It must not be blanket-rejected
as a noun. [強/ㄑㄧㄤ3](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6580)
has force/effort VERB and ADV senses; the remaining anomalous ADJ/NOUN profiles
are left unreviewed. The generated written output and raw UD label do not
independently adjudicate those contextual readings. Preservation tests keep
all these cases unchanged.

Reproduce the next population and compare against the pinned v1 report:

```sh
npx tsx scripts/audit-polyphonic-context.ts --policy standard-role-supplement-followup-trial --output data/generated/polyphonic-role-supplement-followup-after.json
npx tsx scripts/compare-moe-role-supplement.ts data/generated/polyphonic-role-supplement-after.json data/generated/polyphonic-role-supplement-followup-after.json data/generated/polyphonic-role-supplement-followup-comparison.json
```

Follow-up results: both populations generated 2,048/2,048 sentences, the two
reviewed incompatible uses became zero, and only seed 473 / slot 0 and seed
1354 / slot 3 changed. Their replacements are `word:島:ㄉㄠ3` and
`word:早:ㄗㄠ3`; both exact readings match the committed Concised source
projection (bulk source IDs 1047 and 5332 respectively). These source-row IDs
are not online dictionary page IDs. Both are different written words, so the
result is candidate exclusion rather than same-word phonetic correction.

Every v1 replacement is preserved. Rechecking the original v1 comparison with
the shared engine reproduces its original `ff121ac7…367269` SHA-256 exactly.
The follow-up after-population SHA-256 is
`26e637c0d47f04a6f886bd88aa27f353a07069052fc0884b38076e66cf288cb1`;
its comparison SHA-256 is
`c3b0233713c618ff5c98e3567f3ad466304a0251dede00a59e0cc9f219d0cf03`.

Follow-up local validation: `npm run check:pr` passed (241 Vitest files /
1,322 tests, 76 Python tests, typecheck, catalog validation, build and size
budget); `npx playwright test` passed all 62 Chromium tests against that build.
