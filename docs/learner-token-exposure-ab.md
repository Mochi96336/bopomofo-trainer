# Does a learner's frequently mistyped Zhuyin actually appear more often?

This experiment does **not** change production code or learners' progress. It uses
the same active catalog, selected profiles, prepared indexes, grammar policy,
learner-token error scoring, and real `selectFormalSyntaxUtterance` pipeline as
the product. It branches from [#424](https://github.com/Mochi96336/bopomofo-trainer/pull/424)
solely to compare the *same-word corrected-reading preference* against its
historical licensed-weighted replacement, while both use the same reviewed
reading gate.

## Reproduce

```sh
npm ci
npm run app:catalog
npx tsx scripts/audit-learner-token-exposure.ts --samples 256 \
  --output data/generated/learner-token-exposure-ab.json
```

For each deterministic seed, independently draw actual grammar-valid
utterances in five conditions:

| Cohort | Evidence | Same-surface 好/ADJ recovery |
|---|---|---|
| baseline | no learner weakness | enabled |
| weak-tone-4 | 12 tone-4 mistakes / 16 tries | enabled |
| weak-zhuyin-zi | 12 ㄗ mistakes / 16 tries | enabled |
| weak-tone-3 | 12 tone-3 mistakes / 16 tries | enabled |
| weak-tone-4-historical-redraw | same tone-4 evidence | disabled |

All are guided/standard, with zero previous history, identical syntax policy,
frequency values, catalog, and seed index. Token timing evidence is deliberately
disabled so the measured treatment is **error weighting only**.

Count actual expected tokens of the selected catalog entries. For each
cohort/target, report both the share of **generated sentences** containing the
token and the **actual number of expected token occurrences per 100 generated
syllables**. The latter prevents common tones appearing in nearly every
sentence from obscuring frequency differences. Neither measure is the
candidate score shown after generation. Compare paired seeds for both
increases and losses of target exposure, including actual occurrence count
deltas, and include concrete changed sentence IDs. Verify every selected entry/profile identity satisfies reviewed
reading eligibility, and refuse to count `好/ADJ:ㄏㄠ4` as valid tone-4 practice.

### Questions this experiment can answer

1. In 256 independent seeded rounds, does adding the *synthetic* learner's
   error evidence increase realized exposure to their weak expected token?
2. For that same tone-4 weakness, does correcting the standalone adjective
   好 reading by preserving the word instead of selecting a different word
   remove, retain, or introduce tone-4 practice opportunities?
3. Do selection failures or undercoverage remain after enforcing licensed
   readings?

### What it cannot answer

The corpus sentences have no independent naturalness and semantic gold labels.
A higher sampled token incidence is not proof of learning outcomes, and 256
paired samples may be noisy. The cohort is synthetic rather than an individual's
actual error trace, and all experiments keep recency, practice level and
interaction timing fixed. A production decision needs additional tests with
realistic learner history, more random seeds/replications, and human checking
of natural contexts. Never claim improved \"accuracy\" from these results.

The limited practice generator samples **one** complete sentence per selection.
Its internal lexical draw uses error-based weights, but the
`scoreCandidate` metric is computed after the sentence exists. This audit
deliberately separates actual exposure from that post-generation score.

## An important distinction: selecting a question versus labeling its reading

A controlled 1,024-seed experiment fixes subject `他` and allows adjective
entries `好:ㄏㄠ3`, unlicensed `好:ㄏㄠ4`, or legitimate `壞:ㄏㄨㄞ4`
to compete. With a simulated fourth-tone weakness, correcting the
selected standalone adjective `好` to its licensed `ㄏㄠ3` reading
can reduce *fourth-tone exposure* relative to a **different-word redraw**
(earlier measured 578 vs 377 legal fourth-tone alternatives). This is a
pedagogical sampling tradeoff, **not** permission to change the correct
reading of the word to fit the weakness.

The corrected #424 selector keeps the decision independent:
when the selected **word and ADJ context** are `好`, its correct catalog
reading is `ㄏㄠ3` whether the learner is weak on third tone, fourth tone,
or neither. Learner weights can influence *which valid words/utterances*
are sampled, but they cannot veto a reviewed correct pronunciation.
The 1,024-seed CI probe now asserts this behavior under both weak and
no-weakness cohorts, and logs the separate exposure tradeoff.

For future selection improvements, it would be legitimate to prioritize
other fully legal `tone:4` words **before choosing the sentence**. It
would not be legitimate to let the user's incorrect-key history decide
whether the already-selected 好/ADJ is pronounced ㄏㄠ3 or ㄏㄠ4.
