# Aspect predicate-marking calibration audit

This branch is measurement-only and is stacked on PR #261 (`agent/aspect-predicate-marking-axis`). It must not be merged as production code.

The audit answers one narrow question: after retiring peer `clause.aspect`, what Predicate-axis aspect practice weight restores realized product exposure near the pre-retirement product baseline without moving the historical negation ticket boundary?

## Baseline reconstruction

PR #261 is directly based on #259. Its executable behavior delta for this question is limited to retiring `clause.aspect` and adding the `aspect` Predicate-marking ticket. The audit therefore reconstructs #259 inside the exact #261 implementation environment by:

1. inserting the reviewed #259 `clause.aspect` production immediately before `clause.ba`; and
2. injecting the old marking policy as `ordinary=0.943, aspect=0, negation=0.057`.

The production composer then runs normally with the packaged catalog, packaged runtime profiles, product-family planner, product derivation bounds, lexical realization, and the same deterministic seed namespace used for every compared policy.

## Exposure meter

The product meter counts a candidate when at least one selected runtime profile is compatible with the exact aspect lexical gate:

- UPOS `AUX | PART`
- `aspect: marked`

This is a realized lexical-exposure meter. It intentionally does not claim a natural Mandarin frequency. It also stays separate from #260's structural-slot meter; #260 remains the ownership proof showing that bare retirement removes too much aspect practice and that duplicate Clause/Predicate aspect ownership exists.

## Calibration procedure

- measure the reconstructed #259 baseline over 8,192 seeds;
- coarse sweep aspect ticket mass on the first 1,024 identical seeds;
- fine sweep around the closest coarse point on the first 2,048 seeds;
- run the selected neighborhood over the full 8,192 seeds;
- compare success, aspect exposure, root/family distributions, fallback sets, derivation identity, and text per seed;
- keep the negation interval fixed at `ticketUnit >= 0.943` for every candidate policy.

The audit writes `aspect-calibration.json` and `aspect-calibration.md` as CI artifacts.

## Landing rule

Only the final calibrated `ordinary/aspect` weights, accompanying permanent regression updates, and refreshed runtime lock belong in #261. This audit script, workflow, and document stay measurement-only and should be closed unmerged after the calibrated implementation head is independently green.
