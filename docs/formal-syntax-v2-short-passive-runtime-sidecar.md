# Formal Syntax V2 short-passive runtime sidecar

## Purpose

Project reviewed short-passive evidence onto active runtime syntax profiles without reconstructing passive licensing from aggregate valency or marker facts.

The evidence source is reviewed independently in #236. This sidecar reuses that exact occurrence contract and #234's generic runtime-occurrence projection framework.

## Capability

`short-passive-aux-pass-bei-same-occurrence`

Evidence contract:

`same-predicate-aux-pass-bei-v1`

A source predicate occurrence qualifies only when it directly owns a token with:

- exact dependency relation `aux:pass`;
- UPOS `AUX`;
- surface form `被`.

An overt `nsubj:pass` is observed but is not required. Argument omission must not erase direct passive evidence.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18:

- short-passive predicate occurrences: 412;
- distinct short-passive form+UPOS source identities: 264;
- short-passive occurrences with direct `nsubj:pass`: 266;
- reviewed long-passive occurrences: 0.

Identity-safe join against the active runtime profile artifact:

- matched source identities: 252;
- ambiguous matched identities: 4, fail closed: `任/VERB`, `作/VERB`, `稱/VERB`, `處/VERB`;
- unmatched source identities: 12;
- identity-safe activatable identities: 248;
- activated runtime profiles: 248;
- activated catalog entries: 248;
- activated UPOS: VERB only.

The committed sidecar is deterministic and tied to the immutable active-profile artifact digest plus the pinned UD source commit.

## Why aggregate valency is not a backstop

The reviewed identity probe found that among the 248 identity-safe short-passive profiles:

- only 167 carry legacy `transitive` or `ambitransitive` frames;
- only 145 carry legacy `adpositional-complement`.

Those aggregate dimensions therefore cannot serve as projection prerequisites. Requiring either would discard predicates that already have the stronger direct same-occurrence `aux:pass + 被` evidence.

These overlap counts are diagnostic evidence for the ownership decision, not artifact invariants; they may legitimately move as the generic valency projection is repaired.

## Long passive remains unsupported

The reviewed long-passive contract is:

`same-predicate-obl-agent-case-bei-v1`

Pinned Chinese GSD currently contains zero occurrences satisfying it. This sidecar therefore adds **no long-passive runtime capability** and does not collapse short/long evidence into a union flag. A future long-passive capability requires a separate reviewed positive evidence source or contract.

## Product boundary

This sidecar only makes reviewed lexical evidence representable and verifiable. It does not:

- change `clause.bei` or `PassivePhrase`;
- package the short-passive sidecar into app runtime profiles;
- activate or reweight passive practice;
- alter product probability;
- regenerate generic source profiles;
- change Measurement V2 or progress state.

Canonical passive consumption is a separate behavior decision because nested Clause sampling is currently raw and a stricter lexical gate can alter effective product distribution through reachability and retry.
