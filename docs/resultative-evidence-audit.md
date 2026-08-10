# Resultative evidence audit

The formal grammar currently declares a legacy `resultative` valency frame and
uses it in `complement.result`. The packaged valency audit reports zero lexical
support for that frame.

Chinese UD defines a more specific dependency relation, `compound:vv`, for
verb-verb and verb-adjective compounds whose second element includes what
Chinese grammar calls resultative and phase complements. The pinned
`UD_Chinese-GSD` r2.18 relation inventory, however, does not list
`compound:vv`; it uses generic `compound` and `compound:ext` among its compound
relations.

That conversion boundary matters. Absence of the subtype does not justify
relabeling every generic verbal `compound` as resultative.

## Evidence classes

The audit keeps three observations separate:

1. **Exact resultative/phase evidence**
   - child relation is exactly `compound:vv`
   - parent is VERB
   - child is VERB or ADJ

2. **Ambiguous generic verbal-compound candidate**
   - child relation is exactly `compound`
   - parent is VERB
   - child is VERB or ADJ
   - counted only as a diagnostic; never promoted to resultative support

3. **Extent/descriptive compound**
   - child relation is exactly `compound:ext`
   - parent is VERB
   - child is VERB or ADJ
   - kept separate because Chinese UD assigns a different construction label

The output also records all observed `compound` relation labels so source
conversion changes remain visible.

## What this audit does not infer

It does not infer resultative structure from:

- lexical meaning
- verb adjacency
- generic `compound`
- `compound:ext`
- an ADJ following a VERB
- the project's existing `resultative` valency label

If pinned GSD contains zero exact `compound:vv`, the correct result is zero
source support under this contract. A later grammar migration must either use a
source that preserves the distinction or define an independently reviewable
reconstruction algorithm; it must not silently guess from generic compounds.

## Runtime boundary

This audit changes no canonical grammar production, valency projection,
compact runtime profile, sampling policy, or runtime lock.

## Reproduction

With pinned Chinese GSD r2.18 materialized at the normal source location:

```sh
python scripts/audit-resultative-evidence.py
```

The CLI validates the pinned source checksums/sizes and emits aggregate counts
plus a deterministic digest. It emits no sentence text or lexical rows.
