# Extended reading review queue

Source population: `98f47ff`, policy `standard-role-supplement-followup-trial`,
the same seed namespace and bounds as the previous 2,048-seed comparisons.
Generated locally on 2026-11-07:

```sh
npx tsx scripts/audit-polyphonic-context.ts --samples 4096 --policy standard-role-supplement-followup-trial --output data/generated/polyphonic-role-supplement-extended.json
```

The report has 4,096 successful generations, 0 failures, 2,077 polyphonic
occurrences, and 133 of the 182 ambiguous written forms observed. Its SHA-256:
`b81ea9c6ee491c11814bc89eb47c48f708aa1ff51454d9897203f779b28b0394`.
The first 2,048 sentence records and all their hit records were checked for
exact equality with the previously validated follow-up report. The second
half adds 106 reading/UPOS combinations absent from the first half.

These outputs extend the exposure inventory. They are not independent human
pronunciation gold or a blind accuracy benchmark. Counts below are exact
selected positions, not a product-wide pronunciation error rate.

## Initial source-backed queue

The dictionary distinctions below were inspected before implementation. The
initial queue was not itself a runtime restriction. The implemented result,
including the additional replacement defect found during replay, follows below.

| Reading / selected role | Second-half seed / zero-based slot | Source and preservation boundary |
| --- | --- | --- |
| 與 / ㄩ4 / ADP | 3264/0, 3642/0, 3651/0 | [與](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11662): yù is participation/intervention VERB; the preposition is yǔ. Preserve yù VERB and the separate yú sentence particle. |
| 處 / ㄔㄨ4 / VERB | 2781/2, 3371/3 | [處](https://dict.revised.moe.edu.tw/dictView.jsp?ID=8586): chù is place/unit NOUN; the residence/handling verb is chǔ. Preserve chù NOUN and chǔ's classical surname/adjective uses. |
| 讀 / ㄉㄡ4 / VERB | 3159/3 | [讀](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2001): dòu denotes a pause as NOUN; reading/study VERB is dú. Preserve dòu NOUN and whole-word 句讀. |
| 食 / ㄙ4 / NOUN | 2216/2 | [食](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9995): feeding sì is VERB, unlike food shí. Preserve both verbal readings and yì in names. |
| 洗 / ㄒㄧㄢ3 / VERB | 3945/1 | [洗](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7125): xiǎn has plant-name and surname NOUN senses; washing VERB is xǐ. Preserve rare xiǎn NOUN/PROPN. |
| 哈 / ㄏㄚ3 / PROPN | 2377/0, 3485/4 | [哈](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4723): the independently attested surname is hā. Hǎ is bound in 哈巴. Preserve hā PROPN and the whole bound word. |
| 曾 / ㄘㄥ2 / PROPN | 2710/0, 3571/2 | [曾](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9594): surname zēng differs from céng's ADV/ADJ senses. Both zēng and céng have independently attested ADV uses; do not replace both with a single dominant reading. |
| 任 / ㄖㄣ4 / PROPN | 2709/0 | [任](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9239): surname rén differs from office/assignment rèn. Preserve rèn NOUN/VERB/ADV and rén's classical ADJ. |
| 親 / ㄑㄧㄥ4 / VERB | 3385/1 | [親](https://dict.revised.moe.edu.tw/dictView.jsp?ID=6618): qìng is bound in in-law lexemes; the independent contact/affection VERB is qīn. Preserve exact whole words such as 親家. |
| 合 / ㄍㄜ3 / PROPN | 3127/2 | [合](https://dict.revised.moe.edu.tw/dictView.jsp?ID=3968): the surname is hé; gě is the capacity unit. Preserve gě NOUN and 公合. |

There are ten groups and fifteen selected positions in this initial queue.
It deliberately does not classify every one of the 106 newly exposed groups.
The implementation starts from this immutable source population and uses a
separate ordered redraw stage to preserve earlier accepted output distribution.

## Implemented extended stage

`MOE_EXTENDED_ROLE_RESTRICTIONS` binds the selected catalog identity and UPOS;
the product and `standard-role-extended-trial` audit use it after the two
frozen supplement stages. It does not rewrite catalog identities or learner
progress. The previous 2,048-seed comparison outputs remain byte-identical:
`ff121ac797b43815405464187503dbd1686d1b81aa7091b2ba47d30566367269`
and `c3b0233713c618ff5c98e3567f3ad466304a0251dede00a59e0cc9f219d0cf03`.

The first replay of the fifteen initial positions delivered another incompatible
candidate at seed 3651/slot 0: standalone `大/ㄉㄞ4/ADP`. [大](https://dict.revised.moe.edu.tw/dictView.jsp?ID=1936)
lists dài through bound words such as 大夫; its independent degree adverb uses
dà. The extended stage therefore also rejects `大/ㄉㄞ4` in ADV and ADP, while
leaving exact whole words and unreviewed roles unchanged. This adds the existing
source exposure at seed 2612/slot 2 (ADV) to the frozen manifest. The final scope
is eleven reading identities, twelve reading/role pairs, and sixteen selected
source positions; the intermediate 大 replacement is not counted as a separate
source position.

```sh
npx tsx scripts/audit-polyphonic-context.ts --samples 4096 --policy standard-role-extended-trial --output data/generated/polyphonic-role-extended-after.json
npx tsx scripts/compare-moe-role-supplement.ts data/generated/polyphonic-role-supplement-extended.json data/generated/polyphonic-role-extended-after.json data/generated/polyphonic-role-extended-comparison.json
```

The final replay has 4,096 successful generations and zero failures. Reviewed
incompatible uses fall from 16 to 0. Exactly sixteen seeds change one lexical
slot each, with no changes to other slots, roots, entry counts, or unrelated
sentence text. All sixteen replacements change the written word: this is
exclusion of incompatible candidates, not sixteen same-word tone repairs.
Polyphonic occurrences change from 2,077 to 2,062, and observed ambiguous
written forms from 133 to 131; these are exposure counts, not accuracy scores.

| Local artifact | SHA-256 |
| --- | --- |
| `polyphonic-role-extended-after.json` | `c1f2c6cdc468a1d409625ec8b0e2a5aeacad8050da7d0a11e6e39ffdc4d6e2d3` |
| `polyphonic-role-extended-comparison.json` | `6e663e320fd23d376bd7bd096f7bfe7b0da764312ddb2807133895932649b825` |

Ten replacement readings match committed MOE bulk rows. The remaining six
(`院校`, `小津`, `安徽`, `升到`, `弗蘭克`, `為/ㄨㄟ4`) have no matching row
in those partial projections; that absence is not evidence of an error. The
separately inspected [為](https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447)
entry supports wèi as ADP, the role delivered at 3651/0. Neither this comparison
nor those lookup matches constitute independent full-sentence reading approval.

## Catalog retention and actual profile gaps

All eleven reading identities remain in the real practice catalog. The policy
unit tests additionally demonstrate allowed dictionary senses with constructed
profiles; they do not prove that matching real profiles exist or are sampled.
A read-only inspection of the actual product gates, applied to each existing
profile with no preceding word, gives these surviving roles:

| Reading identity | Existing roles surviving the full current reading policy |
| --- | --- |
| 與/ㄩ4 | none |
| 處/ㄔㄨ4 | PART, NOUN |
| 讀/ㄉㄡ4 | none |
| 食/ㄙ4 | none |
| 洗/ㄒㄧㄢ3 | none |
| 哈/ㄏㄚ3 | none |
| 曾/ㄘㄥ2 | ADV |
| 任/ㄖㄣ4 | NOUN, VERB, DET |
| 親/ㄑㄧㄥ4 | PART, NOUN |
| 合/ㄍㄜ3 | none |
| 大/ㄉㄞ4 | PART |

These are policy eligibility results, not independent approval of every surviving
raw UD role or proof of generation probability. In particular, PART/DET roles
left outside this review are not newly dictionary-approved. Six identities have
no existing compatible profile: 與/ㄩ4, 讀/ㄉㄡ4, 食/ㄙ4, 洗/ㄒㄧㄢ3,
哈/ㄏㄚ3, 合/ㄍㄜ3. They currently cannot be selected in a generated sentence.
Preserving their catalog IDs is therefore weaker than preserving practice
availability. A future batch must supply source-backed appropriate lexical
profiles or a suitable bound-word practice context; do not manufacture a profile
merely to make a preservation test pass.

Validation on 2026-11-07: `npm run check:pr` passed 1,364 Vitest tests, 76 Python
source-adapter tests, type checking, catalog validation, production build, and
the bundle budget. JavaScript gzip size is 481.18 kB (decimal), below 500,000
bytes. The 4,096-seed A/B evidence above is local; no additional full historical
CI replay job is implied by this report. `npx playwright test` passed all 62
Chromium tests against the same production build.

## Rare readings explicitly retained after inspection

- [稱](https://dict.revised.moe.edu.tw/dictView.jsp?ID=8546) permits chèng
  as a suitability VERB and as a weighing-tool NOUN; chèn is an alternate
  pronunciation of that reading. The new `稱/ㄔㄥ4/VERB` and
  `稱/ㄔㄣ4/NOUN` exposures must not be excluded merely because chēng is
  more familiar.
- [解](https://dict.revised.moe.edu.tw/dictView.jsp?ID=5627) has a genuine
  historical government-office jiè NOUN sense. Its existing NOUN exposure is
  not proof of a reading error.
- [高中](https://dict.revised.moe.edu.tw/dictView.jsp?ID=68984) distinguishes
  school gāozhōng from the examination-congratulation gāozhòng. Its sampled
  NOUN profile needs contextual/lexical-function review; the dictionary's
  description of the latter as a congratulatory expression is not itself a
  machine-readable POS prohibition.

Do not promote source-attested words or raw UD labels into independently
approved sentence-reading labels. Where evidence is insufficient, retain
unknown rather than inventing a tone, deleting the rare catalog identity, or
optimizing sentence naturalness.
