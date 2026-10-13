# Formal Syntax V2 — Phase 1 structural closure

## Milestone definition

Phase 1 closes the **structural ownership** migration of the current formal
syntax grammar.

This milestone does not claim that Mandarin syntax is complete. It establishes
a stricter engineering boundary:

- structures with approved evidence are represented by the intended owner;
- executable paths with no approved support are retired;
- unresolved source questions are named as evidence-blocked frontiers;
- product legality, lexical evidence, and curriculum sampling remain separate;
- the remaining live grammar has no zero-support production slot.

## Closed structural ownership work

The phase includes the completed migration of:

- predicate-frame ownership for ordinary nominal, adjectival, verbal, copular,
  existential, and locative predication;
- predicate marking separated from Clause identity;
- subject/object realization separated from Clause identity;
- BA, BEI, and 比 comparative construction ownership;
- structural clausal Subject via the shared Subject role;
- finite ccomp ownership through Subject + Predicate + ContentClause;
- narrow reviewed 有關 relational-adjective ccomp;
- quotation packaging separated from objecthood, with the live quotation rule
  narrowed to the reviewed ccomp-like reporting slice;
- retirement of controller-specific xcomp Clause rules that have zero approved
  controller evidence.

## Evidence-blocked frontiers

Phase 1 intentionally leaves exactly two live legacy `VerbPhrase` consumers.

### clause.topic-comment

Evidence contract:

`pinned-gsd-topic-dislocation-inventory-v1`

Pinned GSD `dislocated` is a negative licensing boundary. The dominant
source shape is not a narrow Mandarin sentence-initial topic construction, so
the current NP + VerbPhrase rule is not rewritten from that relation alone.

Next phase: **information structure / topic-dislocation source rebuild**.

### sentence.constituent-subject-question

Evidence contract:

`pinned-gsd-licensed-wh-direct-subject-shape-inventory-v1`

Only 9 reviewed licensed interrogative tokens occur directly as nsubj, and only
1 / 9 has a root governing head. The current root template is not source-aligned
enough to replace safely with ordinary Clause machinery without broader root
evidence.

Next phase: **interrogative Subject / embedded-vs-root rebuild**.

These rules are deferred, not approved as final V2 designs. Their exception is
machine-readable in `FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS`.

## Closure gate

CI runs `audit-formal-syntax-v2-phase1-closure.ts`.

Phase 1 is closure-ready only when all blocker counts are zero:

1. grammar validation errors;
2. zero-support live production slots;
3. retired Clause rules leaking into the live grammar;
4. live requirements for controller-specific xcomp frames;
5. unregistered Sentence/Clause `VerbPhrase` consumers;
6. registered frontier consumers missing from the live grammar;
7. live Clause rules missing from the Clause Model V2 migration inventory;
8. stale Clause Model V2 current-migration entries;
9. sampling-taxonomy coverage errors.

The two registered evidence-blocked frontiers are therefore explicit exceptions,
not hidden migration debt.

## What is not part of Phase 1

The following belong to later work:

- productive topic/dislocation reconstruction;
- root constituent-subject-question reconstruction;
- generic xcomp controller recovery from a richer approved source;
- quoted xcomp/parataxis attachment support;
- broader advcl / serial-like predicate-structure reconstruction;
- future curriculum incidence changes for these structures.

Those tasks can now proceed without reopening the ownership cleanup completed in
this phase.

## Final product baseline

After this closure gate merges, a separate deterministic 2,048-seed run should
be pinned against that exact main commit. That baseline becomes the comparison
point for future Phase 2 grammar and curriculum work.
