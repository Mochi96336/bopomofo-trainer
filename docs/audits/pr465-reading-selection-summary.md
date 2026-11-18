# #465 — Reading-frontier audit: consolidated decision

**Decision (2026-11-18): keep #464 Draft and preserve the current abstention policy.** No production code, syntax rules, reading policy, or catalog entries changed in #465. The unrestricted arm is an unsafe **measurement-only** counterfactual, not a release candidate.

**Scope:** written-form / pronunciation-entry identity, MOE reading-policy non-regression, candidate-frontier exclusion, and final delivered selection only. **Explicitly excluded:** semantics, word-sense annotation, naturalness, semantic validation and new semantic models. No future semantic work is implied by this audit.

## Two measurements, not one loss rate

| Scope | 128 sequential rounds: removed candidate profiles / examined | Distinct blocked form×UPOS groups | 128 independent paired first rounds: changed selected entry-ID sequences | Distinct final forms (guarded / unrestricted) | Same-form+UPOS aligned reading changes |
|---|---:|---:|---:|---:|---:|
| All | 18,743 / 819,170 (2.29%) | 185 | 124 / 128 | 395 / 403 | 0 |
| Tier 1 | 9,253 / 99,224 (9.33%) | 101 (65 forms) | 120 / 128 | 320 / 316 | 0 |
| Tier 2 | 4,322 / 137,111 (3.15%) | 39 | 102 / 128 | 275 / 268 | 0 |
| Tier 3 | 3,404 / 199,283 (1.71%) | 32 | 105 / 128 | 305 / 298 | 0 |
| Tier 4 | 2,188 / 393,152 (0.56%) | 18 | 91 / 128 | 316 / 314 | 0 |

- **Do not equate** repeated candidate-profile removals (including failed/retried slots) with final exercise loss.
- Paired first-round trials give **542/640 changed selected entry-ID sequences**, but **0 aligned same-written-form+UPOS pronunciation substitutions**. This is not a global guarantee of pronunciation correctness; word substitutions account for most changes.
- The unrestricted trial directly selected **說/ㄕㄨㄟˋ/NOUN once (All)** and **都/ㄉㄡ/NOUN once (Tier 1)**; the guarded arm selected neither. These are exact entry-ID×UPOS observations, not a population mispronunciation rate.
- Guarding yielded more distinct final written forms in Tier 1–4 in this finite sample; removing abstention is **not** demonstrated to improve final coverage.
- The two trials have different designs: sequential 128-round product paths for frontier incidence vs 128 independently seeded *first rounds* per scope for delivery differences. Neither estimates learner population rates.

## Reproduction and acceptance

Only two runnable audits remain:
1. `tests/readings/pr464-slot-census.audit.test.ts`: measured licensed candidate-frontier removals, unmodified baseline product selections, compact aggregated log.
2. `tests/readings/pr465-reading-abstention-delivery-delta.audit.test.ts`: paired selected-entry identity comparisons, same-form reading-position comparisons, and exact five-role exposure counts; compact aggregated log.

All other exploratory audit files were removed from this branch to avoid duplicate/conflicting conclusions. Their **immutable historical snapshot** remains in commit [`83a09a8`](https://github.com/Mochi96336/bopomofo-trainer/tree/83a09a8a2345c91b98e58629a68a364a554d7312), not in active audit contents. Past examples and references are **not** acceptance criteria.

Base: #464 `2bd6e02`. Keep complete existing 2,048-seed historical reading regression, check, and browser CI. A passing CI verifies the implementation/testing invariants, not a new permission to lift abstention. **Release decision: do not merge #465 into production; do not reopen the five isolated reading roles on this evidence.**
