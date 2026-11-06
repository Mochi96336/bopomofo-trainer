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

## Next source-backed role leads

The dictionary distinctions below were inspected; the next implementation must
still bind them to the exact selected entry/profile, preserve legitimate
alternative usages, and verify the whole paired population. None of this
queue is automatically a new runtime restriction.

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
Start the next batch from this immutable source population; use the separate
ordered redraw stage to preserve earlier accepted output distribution.

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
