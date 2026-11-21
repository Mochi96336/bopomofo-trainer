# Real learner-target exposure A/B — separate sampling from pronunciation

This Draft is a **read-only experiment**. It does not modify the selected
pronunciation, the product selector, the catalog, or learner progress.
It is based on the active legal-pronunciation policy in Draft #424.

## Question

When a learner often types a Zhuyin component or tone incorrectly, does
the existing frequency-first **lexical sampling** cause actually selected
legal exercises to contain that *exact* weak token more often?

## Method and reproduction

```sh
npm ci
npm run app:catalog
npx tsx scripts/audit-learner-token-exposure.ts --samples 256 \
  --output data/generated/learner-token-exposure-ab.json
```

Use 256 identical random seeds for four independent cohorts:
- No weakness / no binding evidence
- `tone:4` weak (12 errors in 16 attempts)
- `zhuyin:ㄗ` weak (12 errors in 16 attempts)
- `tone:3` weak (12 errors in 16 attempts)

All call the **real** `selectFormalSyntaxUtterance` with the active
catalog, prepared lexical and structural state, the same construction
policy, empty/frozen recent history, guided/standard mode, and reviewed
`readingEligibility`. Timing evidence is zero, so this isolates error
weights only. We verify every chosen entry/profile identity against the
role-based reading gate.

We count both whether a selected sentence contains each Zhuyin target
and the **number of actual token occurrences per 100 generated syllables**.
We also record exact changed seeds, target gains/losses, candidate generation
attempts and fallback rates.

### Earlier observed results

On a previous fixed 256-seed experiment with the active selector family,
simulated weakness raised observed per-100-syllable incidence:
- ㄗ: 3.34 → 4.70
- Third tone: 18.12 → 23.99
- Fourth tone: 34.23 → 39.05

These are snapshots, not outcome guarantees. This branch runs the
experiment again against the latest #424 without its removed
same-written-word repair.

### Interpretation and hard separation of concerns

**A learner's error history determines which *valid* words/sentences are
more likely to be sampled. It never determines the correct pronunciation
of a selected word in its reviewed context.**

If `好:ㄏㄠ4` is drawn for a standalone adjective position, that reading
is invalid. #424 redraws only the lexical slot from legal entries
according to their actual learner/frequency weights. This does **not**
credit an invalid fourth-tone identity, and it does not rewrite a
correct 好:ㄏㄠ3 entry's tones.

An earlier opt-in "pre-filter every slot" experiment changed 215 of
2,048 pinned sentence outcomes (207 without 好/ADJ in the baseline).
This is deterministic sample coupling drift, not evidence that 215
pronunciations were wrong. The former experiment stays documented in
[its workflow run](https://github.com/Mochi96336/bopomofo-trainer/actions/runs/39294460936);
its optional selector plumbing is intentionally excluded from this lean
research PR.

### Limits

Synthetic, fixed-time evidence and only 256 seeds do not prove actual
learning effectiveness, fully natural sentence generation, calibrated
reading accuracy, or statistical monotonicity across all learners.
The high baseline presence of common tones makes the binary
present/absent rate a poor metric; hence the per-syllable count.
No CI should substitute for independently reviewing sense/reading labels.
