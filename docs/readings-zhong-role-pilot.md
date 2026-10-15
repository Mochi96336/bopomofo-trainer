# 種: opt-in noun-versus-verb pronunciation trial

The MOE Concised Dictionary distinguishes `種 ㄓㄨㄥ3` in a category,
seed or classifier sense from `種 ㄓㄨㄥ4` as the planting action.
The source-linked lexical review dataset includes both entries.

This experiment is **NOT an automatically approved sentence-level sense
classifier**. The generator's UD syntax profiles are projected by surface
word and may be shared by unrelated pronunciation identities.

The trial therefore limits *only* these role/identity pairs:

| Syntax role | Licensed in the trial | Other reading |
|---|---|---|
| 種 / NOUN | ㄓㄨㄥ3 | Excluded |
| 種 / VERB | ㄓㄨㄥ4 | Excluded |
| 種 / any other UPOS | Unknown → leave both eligible | Neither excluded |

Existing `reviewedRoleReadingEligible` checks remain applied. The trial
uses the composer’s existing rejection-only resampling, which preserves the
original draw and random stream for already-licensed candidates.

## Repeat

```bash
npm run app:catalog
npm run readings:audit -- --policy reviewed-roles \
  --output data/generated/polyphonic-context-reviewed-roles.json
npm run readings:audit -- --policy zhong-role-trial \
  --output data/generated/polyphonic-context-zhong-role-trial.json
npx tsx scripts/compare-zhong-role-trial.ts \
  data/generated/polyphonic-context-reviewed-roles.json \
  data/generated/polyphonic-context-zhong-role-trial.json \
  data/generated/polyphonic-zhong-role-trial-comparison.json
```

The comparison **fails** if any originally licensed/unrelated seed changes,
if any sampled trial hit still has a forbidden scoped reading, or if sentence
generation fails in either sample. The trial MUST exercise at least one
previously disallowed target in 2,048 seeds, or it is inconclusive and fails.

Even if green, this does not prove that the `NOUN/VERB` role assigned to a
particular generated sentence is semantically correct. Before production
activation, independently review representative examples and counterexamples,
especially any surface-keyed UD profile mistaken for lexical-sense evidence.

There is **no change** to the product's policy, packaged catalog or learner
progress in this PR. It is one bounded study, not a new browser model.
