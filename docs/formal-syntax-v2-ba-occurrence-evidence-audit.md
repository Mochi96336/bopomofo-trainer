# Formal Syntax V2 BA occurrence evidence audit

## Question

Before `clause.ba` receives any new runtime capability or product activation, determine whether a predicate occurrence in pinned Chinese GSD actually realizes the BA construction.

The audit does not infer BA from independent aggregate facts such as:

- predicate is broadly transitive;
- the corpus contains `把` somewhere;
- the predicate has some base `obl` occurrence.

## Reviewed occurrence contract

A predicate occurrence satisfies `same-predicate-obl-patient-case-ba-v1` when:

1. the predicate has a **direct** child with exact UD relation `obl:patient`;
2. that patient has a **direct** child with relation `case`;
3. that case token is `ADP` and its surface form is one of the reviewed BA markers `把` or `將`.

All facts must occur in the same dependency tree occurrence.

This deliberately preserves the UD relation subtype. The aggregate syntax-profile projector currently reduces child relations to their base relation and therefore cannot establish this contract from generic `obl` evidence.

## Pinned reviewed boundary

For Chinese GSD r2.18 at commit `e0d85a020182e264d6384be2a59c0f4879a1cc35`:

- direct exact `obl:patient` predicate occurrences: **196**;
- distinct direct-`obl:patient` `(form, UPOS)` keys: **165**;
- full BA-marked patient occurrences: **193**;
- distinct BA-marked `(form, UPOS)` keys: **162**;
- reviewed marker occurrences: **把 = 61**, **將 = 132**.

These are source-occurrence measurements, not aggregate lexical capabilities. The `--verify` audit mode locks this boundary in CI so a parser, source, or scanner change cannot silently alter the reviewed frontier.

## Current scope

This branch only provides the pinned-source scanner, audit command, synthetic regression tests, and CI verification. It does not:

- add a `RuntimeOccurrenceCapability`;
- change `clause.ba`;
- regenerate active runtime profiles;
- activate BA practice;
- alter product sampling or probability;
- modify #221 or #232;
- touch Measurement V2 or progress state.

Run the corpus audit interactively with:

```sh
npx tsx scripts/audit-ba-occurrence-evidence.ts
```

Verify the reviewed pinned boundary with:

```sh
npx tsx scripts/audit-ba-occurrence-evidence.ts --verify
```

A later reviewed step may identity-join the measured occurrence set into a BA-specific runtime capability sidecar. That remains a separate migration slice.
