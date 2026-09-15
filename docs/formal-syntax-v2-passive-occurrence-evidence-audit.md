# Formal Syntax V2 passive occurrence evidence audit

## Question

Before `clause.bei` receives a reviewed runtime occurrence capability, determine which predicate occurrences in pinned Chinese GSD actually instantiate short and long passive structures.

Do not infer passive from independent aggregate facts such as:

- a predicate is broadly transitive;
- the corpus contains 被 somewhere;
- the predicate has generic `obl` or `nsubj` evidence;
- a passive marker and a passive subject were observed in different occurrences.

## Reviewed short-passive contract

A predicate occurrence satisfies `same-predicate-aux-pass-bei-v1` when the predicate has a **direct** child that is:

- exact UD relation `aux:pass`;
- UPOS `AUX`;
- surface form `被`.

An overt `nsubj:pass` is measured separately and is **not** required by the contract. Mandarin permits argument omission, so absence of an overt passive subject must not erase otherwise direct short-passive evidence.

## Reviewed long-passive contract

A predicate occurrence satisfies `same-predicate-obl-agent-case-bei-v1` when:

1. the predicate has a **direct** child with exact UD relation `obl:agent`;
2. that agent has a **direct** child with relation `case`;
3. that case token is UPOS `ADP` with surface form `被`.

Again, direct `nsubj:pass` on the predicate is measured separately rather than used as a hard requirement.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18 currently yields:

- short passive predicate occurrences: **412**;
- short passive distinct lexeme+UPOS keys: **264**;
- short passive occurrences with direct `nsubj:pass`: **266**;
- long passive predicate occurrences: **0**;
- long passive distinct lexeme+UPOS keys: **0**;
- long passive occurrences with direct `nsubj:pass`: **0**;
- reviewed short/long union: **412 occurrences / 264 lexeme+UPOS keys**.

These numbers are pinned evidence boundaries, not product weights. The audit command fails closed if the pinned source drifts from them.

The zero long-passive boundary is meaningful: this source does not currently support activating a reviewed long-passive runtime capability. Long passive should remain evidence-unsupported until a separate reviewed source or contract supplies positive occurrences.

## Why two contracts

Short and long 被 passives have different dependency shapes and should not be collapsed into one aggregate marker fact. Keeping separate contracts prevents the strong short-passive evidence from being used to manufacture long-passive evidence that the pinned source does not contain.

## Current scope

This branch only provides:

- a pinned-source short/long passive occurrence scanner;
- a fail-closed pinned-boundary audit command;
- synthetic regressions for exact same-occurrence matching;
- explicit measurement of whether each reviewed occurrence also carries `nsubj:pass`.

It does not:

- add a `RuntimeOccurrenceCapability`;
- change `clause.bei` or `PassivePhrase`;
- package passive evidence into app runtime profiles;
- activate or reweight passive practice;
- regenerate generic syntax profiles;
- change Measurement V2 or progress state;
- modify #221, #232, #234, or #235.

Run the fail-closed pinned-source audit with:

```sh
npx tsx scripts/audit-passive-occurrence-evidence.ts
```

For a read-only measurement without enforcing the reviewed counts:

```sh
npx tsx scripts/audit-passive-occurrence-evidence.ts --measure
```

A later reviewed slice may identity-join the **short-passive** contract into an independent runtime occurrence sidecar. The long-passive contract remains audit-only while its pinned boundary is zero.
