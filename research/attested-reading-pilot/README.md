# First attested-reading and weakness-weighting pilot

**Purpose:** Stop treating random generated sentences or UD's `Translit`
as pronunciation gold. Measure the gap using real, **source-verifiable**
Chinese texts before changing the production generator.

## The two independent references

- **Natural text + word boundary:** Traditional Chinese UD GSD
  `zh_gsd-ud-dev.conllu`, pinned to Git blob
  `8b967948097a2e4bebe7f5d0e053c4fed4fe3baa`.
  Each `cases.json` record stores its `dev-s...` sentence ID, full
  source sentence, exact UD token number and form, UPOS, original
  `Translit` and token start. These are *actual corpus sentences*, not
  LLM-generated training examples. Origin: Universal Dependencies /
  Google's Chinese treebank conversion; licensed **CC BY-SA 4.0**.
  Source: https://github.com/UniversalDependencies/UD_Chinese-GSD
  License: https://creativecommons.org/licenses/by-sa/4.0/
- **Pronunciation evidence:** Each case separately cites an exact word
  or sense entry in Taiwan MOE's Revised Mandarin Dictionary, stores
  the **target character** and its reviewed Zhuyin, and separately
  stores the reviewed complete word's Pinyin. The target character's
  reading is the only scored ground-truth answer at this stage.

Credit and share-alike terms apply to the redistributed treebank
sentences. Do not detach these sentences from the GSD attribution,
license or version. MOE URLs attribute the pronunciation facts; they
are not evidence that all original corpus sentences are contemporary
conversational language or that the other characters have been
phonetically reviewed.

## Initial fixed sample

Exactly **18** attested character-in-word contexts, spanning:
- 好 (ㄏㄠˇ vs ㄏㄠˋ): 良好／好奇／喜好
- 行 (ㄏㄤˊ vs ㄒㄧㄥˊ): 銀行／行業／步行／行動／行為
- 種 (ㄓㄨㄥˇ vs ㄓㄨㄥˋ): 種／種子／種植
- 給 (ㄍㄟˇ vs ㄐㄧˇ): 給／給予／補給
- Two **non-polyphonic practice controls** for ㄗ: 子女／自己

Each row is tied to a precise UD sentence and the exact word token,
not an invented recombination. The two rows for `種植` are separate,
real attested contexts, not independent dictionary reading classes.

**Crucial finding:** the UD `Translit` column is *not safe ground
truth*. For example: source `hǎoqí` for 好奇 versus MOE `hàoqí`;
`yínxíng` for 銀行 versus `yínháng`; `zhǒngzhí` for 種植
versus `zhòngzhí`; `gěiyǔ` for 給予 versus `jǐyǔ`.
Some whole-token differences concern **other syllables** (for
example 行為: source `xíngwèi` vs reviewed `xíngwéi`) and must
never be counted indiscriminately as target-character reading errors.

## Runnable, independent reading-first prototype

```sh
npm ci
npx vitest run tests/readings/attested-reading-pilot.test.ts
npx tsx scripts/prototype-attested-reading-selector.ts \
  research/attested-reading-pilot/cases.json \
  data/generated/attested-reading-weight-only-ab.json
```

The pilot first loads **fixed, manually reviewed target readings**.
Only then does a small, explicitly **non-production** weighted lottery
choose which *attested complete sentence* and target character to
practice. Four cohorts share the same 8,192 seed indices: no weakness
and hypothetical 12/16 mistakes for fourth tone, third tone, or ㄗ.

The boosted case gets `1 + min(0.45, 0.6 * errorRate)` weight, only
if the already reviewed target character's Zhuyin contains that
weak token. This formula is deliberately a simplified independent
counterfactual, **not** the production frequency-first implementation.
The precise population probability is computed, as are deterministic
paired sampled exposures. No matter what the weakness is, the gold
reading of a case remains bit-identical.

## What this does NOT yet establish

- Only **one target character per context** has a confirmed answer.
  There is no complete-sentence Bopomofo solution yet; do **not**
  present the source sentence as a fully scored typing exercise.
- The pilot is **not a disambiguation model** and is not running
  the existing product grammar in a new way. It is a clean candidate
  selection reference for later comparisons.
- The UD token/POS may contain annotation errors and the corpus
  source sentence may sound encyclopedic or archaic. Corpus-attested
  does not mean manually accepted as a short natural *practice* prompt.
- Even an exact match between a catalog word and one reading does not
  prove current production context disambiguation accuracy.
- With only 18 cases, especially only two ㄗ controls, numbers
  demonstrate mechanism, not real personalized learning effectiveness
  or population-level generalization.

## What to build next — after this gate passes

1. Inspect actual source text/word-boundary and MOE link rows independently
   and expand natural contrasts (do not make synthetic paired sentences).
2. Score the **existing system** separately: does its lexicon contain the
   correct target *word/readings*, and can a context module assign the
   correct sense? Distinguish missing, multiple options, wrong, unknown.
3. Only then run a paired reading-first candidate selector against the
   product's actual learner error distribution with source-attested
   sentence-quality review. The existing Draft #424/#425 changes remain
   isolated, and this research does not modify them.

**Draft, read-only, do not merge automatically.**

## Early exact-word practice catalog coverage (separate from G2P)

```sh
npm run app:catalog
npx tsx scripts/audit-attested-catalog-coverage.ts \
  research/attested-reading-pilot/cases.json \
  data/generated/attested-catalog-coverage.json
```

This independent second report checks whether the **current actual
practice catalog** has an entry with the same **whole written lexical
token**, the same number of syllables, and the correct target-character
Zhuyin tokens in the same position. It separates missing words,
incompatible syllable spans, correct reading absent, correct reading
present but competing with other readings, and correct reading
present without competing aligned entries.

It is only a **candidate coverage audit**; it does not apply the corpus
sentence's syntax to the runtime selector. A correct entry existing is
not proof that the generated sentence would use it, and a missing entry
is not a wrong model prediction.

## First measured result (specialized CI, 2026-10-22 Taiwan)

At the 18-case pinned sample, **11** original UD whole-token
`Translit` strings differ from independently reviewed complete-word
Pinyin. This is a **whole-word disagreement**, which can involve a
different syllable than the target. Never treat all 11 as target-character
errors or as product mistakes.

The independent reading-first toy lottery, using synthetic 12/16 errors
and **8,192 fixed seeds** per cohort, yielded:

| Weak token | Exact baseline target probability | Weighted | Selected cases before → after |
|---|---:|---:|---:|
| `tone:4` | 27.8% | 35.8% | 2,292 → 2,977 |
| `tone:3` | 44.4% | 53.7% | 3,599 → 4,342 |
| `zhuyin:ㄗ` | 11.1% | 15.3% | 912 → 1,256 |

The actual generated practice catalog (13,692 active entries in this
CI run) contains the target word and correct reviewed reading for
**all 18/18**: 15 have no competing aligned pronunciation within the
*same written word*, while **three** have another competing identity.
The three exact ambiguous items are `dev-s241 種/ㄓㄨㄥˇ`,
`dev-s5 給/ㄍㄟˇ` and `dev-s287 給/ㄍㄟˇ`. The real-corpus
sentence/word reading distinction is therefore more informative than
only asking whether the lexicon happens to contain these entries.

**Do not misread 18/18 catalog candidate availability as 18/18
contextual pronunciation accuracy.** No natural whole sentence was
automatically disambiguated in this phase. The prototype uses the MOE
reading label as an input, not a model prediction.
