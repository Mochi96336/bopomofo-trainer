# Formal Syntax V2 — Modality Source Evidence Audit

This audit inventories the pinned UD Chinese GSD AUX evidence before any executable `modality` lexical feature is introduced.

## Source boundary

- provenance: `ud:chinese-gsd-r2.18`
- source version: `r2.18`
- source commit: `e0d85a020182e264d6384be2a59c0f4879a1cc35`
- inventory contract: `pinned-gsd-aux-feature-inventory-v1`
- positional probe contract: `same-token-exact-aux-preverbal-v1`

The inventory preserves exact dependency relation subtypes and the token-local FEATS column. The positional probe additionally records whether an exact `aux` token precedes or follows its dependency head. Neither form identity nor head position is promoted to semantic modality evidence.

## Reviewed counts

Pinned GSD contains 3,893 `UPOS=AUX` token occurrences across 66 written forms.

Exact dependency relations:

- `aux`: 1,828
- `aux:pass`: 425
- `cop`: 1,630
- other relations combined: 10

AUX morphology:

- `Aspect=Perf`: 824
- `Aspect=Prog`: 131
- `Polarity=Neg`: 112
- `Voice=Pass`: 425
- `Mood=*`: 0
- `VerbType=*`: 0

The source therefore contains no direct Mood or VerbType feature that can be projected as positive modality evidence.

## Exact-aux position split

The 1,828 exact-`aux` occurrences split cleanly by token position relative to their dependency head:

- preverbal: 875
- postverbal: 953

On this pinned source, all 953 postverbal exact-`aux` occurrences are accounted for by three aspect markers:

- `了`: 763 postverbal occurrences
- `著`: 130
- `過`: 60

The corresponding full-form counts are `了` 764, `著` 131, and `過` 60. The two remaining occurrences (`了` once and `著` once) are preverbal but still carry their aspect FEATS, so position alone is not a semantic classifier.

Conversely, common modal-looking forms occur in the preverbal exact-`aux` partition, including `會`, `可以`, `可`, `能`, `能夠`, `要`, `可能`, `必須`, `應`, and `應該`.

This is positive evidence for a source-level **preverbal auxiliary occurrence partition**. It is not positive evidence for a semantic `modality` class.

## Confound separation

The exact source also distinguishes major non-modal AUX uses directly:

- `了`: 764 occurrences, all exact `aux`, all `Aspect=Perf`
- `著`: 131 occurrences, all exact `aux`, all `Aspect=Prog`
- `過`: 60 occurrences, all exact `aux`, all `Aspect=Perf`
- `被`: 412 occurrences, all exact `aux:pass`, all `Voice=Pass`
- `是`: 885 occurrences, all exact `cop`

`為` is mixed: 553 `cop` occurrences and 13 `aux:pass` occurrences with `Voice=Pass`.

Exact relation + FEATS therefore separates aspect/passive/copular confounds, and head position exposes an additional syntax-only preverbal/postverbal split. None of those facts supplies a direct Mood/VerbType modality label.

## Architectural consequence

Do not implement `modality` as any of the following:

1. `UPOS=AUX` alone;
2. the old `UPOS=AUX + function=auxiliary` gate;
3. exact `aux` after subtracting known aspect/passive/copular evidence; or
4. exact `aux` + preverbal position.

The fourth option is a substantially stronger syntactic observation than the previous gates and may justify a future syntax-only `preverbal-auxiliary` capability if an explicit consumer needs it. It still must not be renamed to semantic modality without a separate positive evidence contract.

Until such a contract and consumer are chosen, modality consumer activation remains fail-closed.

## Evidence ownership boundary

This file records corpus observation evidence. It does not by itself define the full productive extension of a Mandarin grammatical construction, and it does not assign product probability.

Keep these layers separate:

1. corpus observation — what the pinned source actually attests;
2. grammatical capability — what Formal Syntax licenses;
3. construction realization — how a derivation expresses that capability; and
4. product activation/probability — how often the trainer selects it.

An observation can provide high-confidence practice evidence without automatically becoming a complete lexical whitelist for productive grammar.

## Non-goals

- no runtime morphology projection change
- no new `modality:*` lexical matcher
- no hard-coded modal whitelist
- no `predicate.verb.expanded` consumer change
- no Clause marking retirement
- no product sampling change
- no Measurement/progress change
