# Attested context → independently reviewed target reading → weighted selection

**Status:** isolated research pilot, **not** active in `src/product/session.ts`.

## Why this is being built

The user's training objective is to practise the **Zhuyin components they frequently mistype**. That learning objective cannot determine the linguistic truth of a word's pronunciation. We need to know which readings are correct in real-word contexts **before** using learner mistakes as selection weights.

Existing Drafts #424 (好/ADJ) and #425 (第N行) have fixed narrowly reviewed reading errors in synthetic grammar outputs, but neither proves that an *entire natural sentence* can be read correctly. This pilot separates **provenance**, **target-only reading correctness**, **lexicon coverage**, **sampling**, and **whole-sentence naturalness** into different gates.

## Data / integrity contract

`research/data/attested-polyphonic-target-pilot.json` contains **17** actual UD Chinese GSD sentences, with contrasting readings for **好、行、種、給**.

Each row includes the original, unmodified **complete corpus sentence**, `train/dev/test-sN` sentence ID, exact UD token index and segmented written word, UPOS as source metadata, source file Git **blob SHA**, original UD `Translit` value, target character offset, independently reviewed **target character** Zhuyin, and its corresponding Taiwan Ministry of Education dictionary URL.

The corpus is UD Chinese GSD, licensed CC BY-SA 4.0; attribution and license URL are embedded in the JSON. Original texts may have additional rights holders as explained in the corpus README:
- https://github.com/UniversalDependencies/UD_Chinese-GSD
- https://github.com/UniversalDependencies/UD_Chinese-GSD/blob/master/LICENSE.txt

**Important finding:** **10 of 17** selected UD Translit hints conflict with the MOE dictionary in the target character. Examples include:
- `銀行`: UD `yínxíng`, MOE **ㄧㄣˊ ㄏㄤˊ** — the target `行` is **ㄏㄤˊ**.
- `種植`: UD `zhǒngzhí`, MOE **ㄓㄨㄥˋ ㄓˊ** — the target `種` is **ㄓㄨㄥˋ**.
- `給予`: UD `gěiyǔ`, MOE **ㄐㄧˇ ㄩˇ** — the target `給` is **ㄐㄧˇ**.
- `補給`: UD `bǔgěi`, MOE **ㄅㄨˇ ㄐㄧˇ** — the target `給` is **ㄐㄧˇ**.
- `愛好`: UD `'àihǎo`, MOE **ㄞˋ ㄏㄠˋ** — the target `好` is **ㄏㄠˋ**.

**Never learn from or score against UD's `Translit` as pronunciation gold.** Its presence in the row is solely for documenting the source and explicit source-label disagreement.

The workflow independently downloads each original UD corpus split, compares its **Git blob SHA** to the pinned version, and verifies every full sentence, exact token index, token text, UPOS and raw Romanization. If UD changes upstream, the audit **fails closed** until the source evidence is re-reviewed. It must not silently refresh any supposedly reviewed label.

## What is and is not gold

**Gold:** only the explicitly indicated **target character** in the corresponding manually screened, source-attested lexical context, linked to its MOE dictionary reading. A case may record the broader word for disambiguation, but does not certify every other syllable of that word (e.g. neutral-tone suffixes) or every other character in its sentence.

**Not gold:** source UD romanization, complete-sentence Zhuyin, a validated naturalness/fluency score, automatic Chinese sentence segmentation, successful G2P for arbitrary words, or review by two independent annotators. Source-attested does not automatically mean appropriate for everyday beginner typing exercises.

The corpus text provides **authentic usage context**. MOE corroborates the **lexical target reading**. Context appropriateness was screened once for the pilot; external blind second review has **not** occurred.

## Two-stage selection proof

`research/attested-target-selector.ts` refuses unreviewed targets. It turns **approved target syllables** into `zhuyin:...` and `tone:...` tokens, then assigns the error-only weighting cap and minimum-attempt threshold from the current production `FREQUENCY_FIRST_UTTERANCE_POLICY`.

Only after target reading is known does it draw a **candidate sentence + target-character pair**. Gold readings are immutable throughout this step. Unlike the full production generator, the pilot gives every candidate the **same baseline weight** to isolate whether simulated weakness increases exposure (4,096 paired deterministic seeds; zero timing/recency effects).

The A/B report tests no weakness versus 12/16 errors for `tone:4`, `tone:3`, or `zhuyin:ㄐ`. It counts actual chosen *gold target* tokens, not an after-the-fact sentence score or token presence elsewhere in an uncertified full sentence.

It separately checks **whether the active catalog contains a target-word reading compatible with the gold**. That is coverage evidence, **not a measurement of the shipping generator's contextual G2P accuracy**.

## Reproduce

```sh
npm ci
npm run app:catalog
npx vitest run tests/readings/attested-polyphonic-pilot.test.ts
npx tsx scripts/audit-attested-polyphonic-pilot.ts
```

To independently reverify the actual UD source files, supply three ConLLU files to:

```sh
npx tsx scripts/verify-attested-polyphonic-sources.ts \
  research/data/attested-polyphonic-target-pilot.json /path/to/ud-gsd
```

GitHub Actions performs that verification automatically, pins source blob SHAs and publishes the complete A/B report artifact.

## What must happen **before** any production changes

1. Correct or exclude any source-attested context that is semantically ambiguous, word-segmented incorrectly, or disagrees with the dictionary — do not use the source's autogenerated pinyin as the answer.
2. Obtain a **second independent reviewer** for target readings without seeing the existing gold labels. The workflow now generates `attested-polyphonic-blind-review.csv` with the same original sentences, target-character positions, and **empty** reviewer reading/confidence/reason columns, intentionally excluding MOE reference URLs, UD romanization and existing gold answers. Collect that review outside this PR and reconcile disagreements; the existence of a blind packet is NOT a completed independent review.
3. Evaluate the current runtime's ability to **accept a full external natural sentence and infer the target reading**. This API/behavior is NOT supplied by the current pilot; do not claim it has been tested.
4. Only then compare a sentence-level candidate selector and the existing grammar selector on actual correct-target exposure, fluency ratings, duplication, and latency. Keep learner weights out of reading resolution.

This Draft is research only. Do **not** merge into main or change the learner's current typing sessions automatically.
