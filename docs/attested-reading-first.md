# Natural-source character readings BEFORE adaptive question weighting

**Status: research-only Draft. No production selection or catalog modifications.**

## Why this experiment

The earlier #424 and #425 PRs fixed narrow written-context reading bugs,
but a grammar-valid, fixed-seed output is not necessarily a natural Chinese
sentence, and a corpus's automatic transliteration can itself be wrong.

The first independently sourced sample set here is
`research/attested-context-v1.json`, containing **12 target-character
readings** in 4 polyphonic groups: **好 / 行 / 種 / 給**. Every snippet
is a verbatim contiguous excerpt of a real sentence in the Traditional
Chinese Universal Dependencies GSD Wikipedia-derived treebank.

**At ingestion**, each excerpt was checked against its exact
`# sent_id` and the target's original CoNLL-U token. Each fixture pins
the `train/dev/test` split, original file name and Git blob SHA so that
the evidence can be retrieved and reviewed again:
https://github.com/UniversalDependencies/UD_Chinese-GSD

### Essential warning: UD's Translit is not pronunciation gold

For example, real upstream data includes:

| UD source | Word and meaning | Auto Translit (do not trust) | Dictionary-checked target |
|---|---|---|---|
| `dev-s231` | 行: poetry lines | xíng | ㄏㄤˊ |
| `train-s693` | 銀行: bank | yínxíng | ㄏㄤˊ |
| `dev-s188` | 種植: cultivation | zhǒngzhí | ㄓㄨㄥˋ |
| `test-s416` | 愛好: enthusiasm/fondness | àihǎo (raw carries extra mark) | ㄏㄠˋ |
| `dev-s278` | 給予: grant | gěiyǔ | ㄐㄧˇ |

**Source annotation ≠ reviewed answer**: a sentence's being from an
existing text says nothing about the reliability of the corpus's
automatically generated transliteration or part-of-speech tag. For
example `test-s335` tags 好 in `好男人` as `PART`, not `ADJ`.
The benchmark records `sourceUpos` as untrusted metadata, not gold.

Correct target readings were mapped independently from the Ministry of
Education Revised Mandarin Chinese Dictionary. Relevant dictionary
evidence:
- 好, including ㄏㄠˇ / ㄏㄠˋ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=4814
- 愛好 ㄞˋ ㄏㄠˋ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=147255
- 行 as a line/row ㄏㄤˊ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=4898&ver=4
- 一行人 ㄒㄧㄥˊ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=149545
- 銀行 ㄧㄣˊ ㄏㄤˊ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=156656
- 種 as a type and as cultivation:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=8169
- 種植 ㄓㄨㄥˋ ㄓˊ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=120566
- 給 ㄍㄟˇ / ㄐㄧˇ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=3994
- 給予 ㄐㄧˇ ㄩˇ:
  https://dict.revised.moe.edu.tw/dictView.jsp?ID=88490

### Licensing and provenance

The excerpted UD treebank text is licensed **CC BY-SA 4.0** according
to the UD GSD README (underlying Wikipedia-origin text may have
additional provenance). The source data excerpts in this JSON are
attributed separately and must retain compatible attribution/license;
the repo's MIT license on original *code* must not be represented as
relicensing the corpus text. Dictionary URLs are evidence links and
dictionary article text is **not copied**.

## Selection prototype: target character, NOT fully spelled-out sentence

The new `src/research/attested-reading-selector.ts` forms one small
character-reading exercise per validated context. The full original
excerpt is shown as **context only** and the exact expected Zhuyin
applies exclusively to the marked **target character**. This is
explicitly not a full sentence copy-typing exercise and it does not
fabricate syllables for unreviewed characters.

The order of operations is:

1. Fetch already sourced text, its exact segmentation target, and
   an independently dictionary-anchored correct character reading.
2. Convert only that fixed correct reading to `zhuyin:...` and
   `tone:...` binding token IDs.
3. Calculate each case's weight using the **existing production**
   `scoreFrequencyFirstEntry` policy.
4. Apply `weightedPick` only across those already legal candidates.
   Learner errors may change a case's probability, **never its label**.

This experiment does not yet have a validated commonness projection for
the small externally sourced subset. Therefore the existing production
weight function correctly treats base frequency as **uniform 1**;
fabricating popularity scores would invalidate the A/B.

### Source split and no training leakage

Only `train` and `dev` items may enter the candidate selection pool.
The `test` items remain **held out for future reading model accuracy
measurement**, not part of the training/selection demonstration.
No model is trained by this PR and therefore no prediction-accuracy
claim is possible. Some fixed readings are in compounds and some are
single-word tokens; record the distinction instead of assuming a
one-character reading rule solves whole-language polyphony.

### Reproduce

```sh
npm ci
npm run typecheck
npx vitest run tests/readings/attested-reading-first.test.ts
npx tsx scripts/audit-attested-reading-first.ts \
  data/generated/attested-reading-first-audit.json
```

Paired baseline / simulated target error cohorts use identical
512-seed sequences and production error boost limits. They report
actual occurrences of correctly labeled targeted components and tones,
not a post-hoc candidate score. These numbers measure *sampled target
exposure only*, not answer accuracy or user learning gains.

## Next research gate — distinct from what this PR proves

Before modifying the shipping product, collect **independently
adjudicated natural sentences with truly ambiguous target characters**
and require a *blinded reading predictor* (lexicon + complete context
and optionally a fixed version model) to label those held-out examples.
Compare exact character-reading accuracy to a most-common-reading
baseline. Separately get human judgments of sentence fluency when using
the generator rather than sourced sentences.

Do not treat the 12 fixed, pre-labeled examples as evidence that a
system automatically disambiguates readings.
