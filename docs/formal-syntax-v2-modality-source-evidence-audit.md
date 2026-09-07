# Formal Syntax V2 — Modality source evidence audit

This audit inventories the pinned UD Chinese GSD AUX evidence before changing the executable Predicate modal consumer or retiring `clause.modal`.

## Source boundary

- provenance: `ud:chinese-gsd-r2.18`
- source version: `r2.18`
- source commit: `e0d85a020182e264d6384be2a59c0f4879a1cc35`
- inventory contract: `pinned-gsd-aux-feature-inventory-v1`
- positional evidence contract: `same-token-exact-aux-preverbal-v1`

The inventory preserves exact dependency relation subtypes and token-local FEATS. The positional probe additionally records whether an exact `aux` token precedes or follows its dependency head. Neither form identity nor head position is renamed to semantic modality evidence.

## Reviewed counts

Pinned GSD contains 3,893 `UPOS=AUX` token occurrences across 66 written forms.

Exact dependency relations:

- `aux`: 1,828
- `aux:pass`: 425
- `cop`: 1,630
- other exact relations combined: 10

AUX morphology:

- `Aspect=Perf`: 824
- `Aspect=Prog`: 131
- `Polarity=Neg`: 112
- `Voice=Pass`: 425
- `Mood=*`: 0
- `VerbType=*`: 0

The source therefore contains no direct Mood or VerbType annotation that can be projected as positive semantic modality evidence.

## Exact-aux position split

The 1,828 exact-`aux` occurrences split by token position relative to their dependency head:

- preverbal: 875
- postverbal: 953

All 953 postverbal exact-`aux` occurrences are accounted for by three aspect-marked forms:

- `了`: 763
- `著`: 130
- `過`: 60

The full exact-`aux` counts are `了` 764, `著` 131, and `過` 60. The two remaining occurrences (`了` once and `著` once) are preverbal but retain aspect FEATS, so position alone is not a semantic classifier.

Conversely, common modal-looking forms occur in the preverbal exact-`aux` partition, including `會`, `可以`, `可`, `能`, `能夠`, `要`, `可能`, `必須`, `應`, and `應該`.

This is positive evidence for a source-level **preverbal auxiliary occurrence partition**. It is not positive evidence for a semantic `modality` class.

## Confound separation

The source directly separates major non-modal AUX uses:

- `了`: exact `aux`, `Aspect=Perf`
- `著`: exact `aux`, `Aspect=Prog`
- `過`: exact `aux`, `Aspect=Perf`
- `被`: exact `aux:pass`, `Voice=Pass`
- `是`: exact `cop`
- `為`: primarily `cop`, with a smaller `aux:pass` passive use

Exact relation + FEATS therefore separates aspect, passive, and copular confounds. Head position exposes an additional syntax-only preverbal/postverbal partition.

## Current executable mismatch

Current `predicate.verb.expanded:modal` accepts any `UPOS=AUX`, while legacy `clause.modal:modal` additionally requires the runtime `auxiliary` function. The previously reviewed runtime-frontier audit found:

- Predicate modal frontier: 62 profiles / 62 entries
- legacy `AUX + auxiliary`: 48 / 48
- 14 extra Predicate profiles are copula-only leakage

Restoring the legacy function gate is still not a complete fix because the 48-profile legacy frontier also contains aspect/passive forms such as `了`, `著`, `過`, and `被`.

Therefore `clause.modal` must not be retired by simply copying either existing lexical gate into Predicate.

## Architectural consequence

Do not define semantic `modality` as any of:

1. `UPOS=AUX` alone;
2. `UPOS=AUX + function=auxiliary`;
3. exact `aux` after subtracting known confounds; or
4. exact `aux` + preverbal position.

The fourth option is a substantially stronger **syntactic observation** and is suitable for review as a future runtime occurrence capability such as `preverbal-auxiliary-same-occurrence`. Such a capability must retain its syntax-only name and evidence contract.

A later consumer slice may use that capability to narrow the Predicate modal-marking slot as a formal-syntax approximation, but it must not claim that the source corpus supplied a complete semantic modal lexicon. Product activation/probability remains a separate decision.

## CI boundary

`scripts/audit-modality-source-evidence.ts --verify` pins the reviewed source counts, exact relation partition, absence of Mood/VerbType annotations, preverbal/postverbal split, and the complete postverbal `了/著/過` frontier. CI fails closed if those facts drift.

## Non-goals

- no runtime occurrence capability in this slice
- no runtime profile projection or app packaging change
- no `modality:*` lexical matcher
- no hard-coded modal whitelist
- no `predicate.verb.expanded` consumer change
- no retirement of `clause.modal`
- no product sampling/probability change
- no Measurement/progress change
