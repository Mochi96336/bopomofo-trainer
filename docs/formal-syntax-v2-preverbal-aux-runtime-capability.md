# Formal Syntax V2 — Preverbal auxiliary runtime capability

This slice projects the reviewed source observation `same-token-exact-aux-preverbal-v1` onto identity-safe active runtime profiles. It deliberately does not call the source observation semantic modality and does not yet change any executable grammar consumer.

## Source evidence

Pinned Chinese GSD r2.18 at commit `e0d85a020182e264d6384be2a59c0f4879a1cc35` contains 875 exact-`aux` occurrences that precede their dependency head, spanning 37 written forms.

The source audit remains authoritative for the positional fact. Aggregate runtime profiles do not retain head-relative occurrence position.

## Identity-safe projection

Runtime projection uses `unique-active-entry-per-form-upos-v1` over `(written form, AUX)` identities.

Reviewed boundary:

- source occurrences: 875
- source forms: 37
- matched form+UPOS keys: 29
- ambiguous matched keys: 7
- activatable keys: 22
- unmatched keys: 8
- activated runtime profiles: 22
- activated catalog entries: 22

Occurrence mass by identity outcome:

- activatable: 460 / 875
- ambiguous: 387 / 875
- unmatched: 28 / 875

The seven ambiguous source keys are:

- `了\u0000AUX`
- `可\u0000AUX`
- `得\u0000AUX`
- `應\u0000AUX`
- `會\u0000AUX`
- `著\u0000AUX`
- `要\u0000AUX`

The eight unmatched source keys are:

- `不想\u0000AUX`
- `不應\u0000AUX`
- `不該\u0000AUX`
- `不需\u0000AUX`
- `不願\u0000AUX`
- `未能\u0000AUX`
- `沒能\u0000AUX`
- `都是\u0000AUX`

The two rare preverbal aspect-marked exceptions (`了`, `著`) are both ambiguous and therefore fail closed instead of entering the runtime capability frontier.

## Runtime contract

Capability:

`preverbal-auxiliary-same-occurrence`

Evidence contract:

`same-token-exact-aux-preverbal-v1`

The generic sidecar validator requires the targeted aggregate runtime profile to remain `UPOS=AUX` with the `auxiliary` function. This is only a backstop on lexical identity. The sidecar itself remains authoritative for the exact-`aux` + preverbal same-occurrence fact.

The committed sidecar is tied to the immutable active-profile artifact digest and records exactly 22 profile IDs / 22 entry IDs. Regeneration fails closed if source counts, identity ambiguity, occurrence mass, or activated profile count drift.

## Product boundary

This slice intentionally has **zero grammar consumers** for `preverbal-auxiliary-same-occurrence`.

Therefore it does not yet:

- narrow `predicate.verb.expanded:modal`;
- change `clause.modal`;
- retire Clause-level modality ownership;
- add a semantic `modality:*` lexical matcher;
- add a modal whitelist;
- change Sentence-family or predicate-marking practice probability.

The next slice must measure the current Predicate modal frontier against this 22-entry reviewed capability before deciding whether it can be a direct consumer gate or whether an explicit fallback/licensing layer is needed. In particular, high-frequency ambiguous forms such as `會`, `可`, and `要` must not be silently discarded without a product-distribution audit.
