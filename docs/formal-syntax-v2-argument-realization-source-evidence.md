# Formal Syntax V2 — argument-realization source evidence

Clause Model V2 treats lexical predicate capability and surface argument realization as separate axes.

The pinned Chinese GSD source contains repeated same-written-form `VERB` occurrences where a direct subject or direct object is overt in some predicate occurrences and absent in others. This is positive evidence that surface realization must not be reconstructed by turning complement absence into lexical `intransitive` / `ambitransitive` truth.

## Reviewed source boundary

The source is the existing pinned provenance record:

- provenance: `ud:chinese-gsd-r2.18`
- release: `r2.18`
- commit: `e0d85a020182e264d6384be2a59c0f4879a1cc35`
- evidence contract: `pinned-gsd-argument-realization-alternation-v1`

For each ordinary `VERB` token, the audit inspects direct dependents on that same predicate occurrence:

- subject overt: `nsubj` or `csubj` after removing relation subtypes;
- direct object overt: `obj` after removing relation subtypes;
- otherwise that argument is recorded as absent for the occurrence.

`iobj` is retained diagnostically but is not folded into direct-object realization.

## Pinned result

Across the pinned source there are **18,217 VERB occurrences / 4,668 written forms**.

Observed overt↔absent alternation:

- subject: **1,216 forms**;
- direct object: **885 forms**.

For a conservative review diagnostic, each state must occur at least twice and account for at least 10% of that form's VERB occurrences. Under that threshold:

- subject frontier: **532 forms**;
- direct-object frontier: **367 forms**;
- both frontiers: **302 forms**.

Thresholded token mass is:

- subject overt **5,097**, subject absent **4,952**;
- direct object overt **4,010**, direct object absent **3,253**.

The threshold is a drift-sensitive review boundary only. It is not a grammar probability and it does not claim that forms outside the threshold cannot participate in Mandarin argument omission.

## Ownership boundary

This evidence means only that **surface realization varies across predicate occurrences**. It does not establish:

- a lexical `subject-omissible` or `object-omissible` feature;
- lexical intransitivity or ambitransitivity from argument absence;
- semantic per-sense omission licensing;
- natural-language omission frequency;
- a product-practice prior.

Positive object / indirect-object / clausal-complement evidence remains predicate-capability evidence. Whether a licensed argument is overt belongs to the `argument-realization` axis.

The executable `clause.subject-omission` and `clause.object-omission` productions are intentionally unchanged by this evidence slice. Retirement and product-practice calibration require a separate implementation based on production drift measurements.

## Verification

`scripts/audit-argument-realization-source-evidence.ts --verify` pins the reviewed source boundary in CI. `tests/scripts/argument-realization-source-evidence.test.ts` separately locks the same-occurrence overt/absent interpretation on synthetic data so a parser or summarizer change cannot silently preserve only the aggregate totals.
