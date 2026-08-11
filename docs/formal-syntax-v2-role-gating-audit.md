# Formal syntax v2: lexical role-gating audit

## Scope

This audit measures the current packaged runtime syntax profiles after the Clause-model v2 passive work. It asks how much lexical reachability is lost when a dependency role observed in the finite UD source corpus is treated as a hard lexical eligibility requirement.

The audit is diagnostic. It does not change grammar legality or sampling.

Source head used for the measurement: `35da420931a6851f6f78c2e4ff99bc4151d01a9a`.

## Packaged profile counts

```text
syntax profiles: 16,061
catalog entries represented: 13,692
```

### Nominal entries

Nominal UPOS is `NOUN | PRON | PROPN` and is deduplicated by catalog entry identity.

```text
nominal entries:                    9,218
observed as subject:                2,890  (31.4%)
observed as object:                 3,056  (33.2%)
observed as oblique:                1,346  (14.6%)

subject ∩ object:                   1,185
object ∩ oblique:                     668
subject ∩ oblique:                    657

without subject observation:        6,328
without object observation:         6,162
without oblique observation:        7,872
```

An `oblique` lexical gate therefore admits only about one seventh of the nominal inventory. Replacing the current BA patient object requirement with a plain lexical `oblique` requirement would not merely model `obl:patient`; it would impose a severe corpus-occurrence filter on which nouns can be patients.

### Verbal entries

The diagnostic verbal set is `VERB | AUX | ADJ`, again deduplicated by catalog entry identity.

```text
verbal entries:                              5,084
observed as predicate:                       1,471  (28.9%)
without predicate observation:               3,613

transitive-capable entries:                  2,103
transitive-capable + observed predicate:       999  (47.5%)
transitive-capable without predicate:        1,104  (52.5%)
```

The current profile projection maps dependency relation `root` to syntactic function `predicate`. Core Predicate slots inherit that function as a hard lexical requirement. As a result, more than half of the packaged transitive-capable entries are excluded from a transitive main-predicate slot solely because their observed GSD occurrences did not include the projected predicate/root role.

## Interpretation

Observed dependency roles and lexical grammatical capability are not the same datum.

The current system is useful when a closed-class construction needs positive evidence for a specific form, but it is over-restrictive when an open-class lexical item must have been observed in every surface role it could grammatically occupy.

The immediate migration implication is:

1. do **not** change BA patients to a hard lexical `oblique` function requirement yet;
2. first stop using observed `root -> predicate` as a mandatory lexical capability gate for the new object-free `Predicate` core;
3. retain UPOS and valency requirements for Predicate heads;
4. later separate nominal structural roles (`subject`, `object`, `oblique/patient/agent`) from corpus occurrence evidence instead of globally removing all nominal role checks at once.

## Reproduction

Run:

```sh
npx tsx scripts/audit-lexical-function-gating.ts
```

The implementation deduplicates by catalog entry ID before counting role coverage and intersections.
