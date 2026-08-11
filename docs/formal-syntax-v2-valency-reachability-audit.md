# Formal syntax v2: valency reachability audit

## Scope

This audit compares the canonical formal grammar's declared `requiredValencyFrames` against the packaged runtime syntax profiles after the Clause-model v2 construction-argument work.

It measures lexical evidence support. It does not by itself decide whether a construction is linguistically invalid; a zero count may instead mean the current UD projection does not derive the corresponding project-specific valency label.

## Packaged frame support

Distinct catalog entries supporting each declared frame:

```text
avalent:                    9,938
intransitive:               3,079
transitive:                 2,103
ditransitive:                  50
ambitransitive:               629
copular:                       50
clausal-complement:           616
open-clausal-complement:      631
adpositional-complement:    1,407
serial-verb:                    0
causative:                      0
resultative:                    0
```

The audit covers 16,061 packaged syntax profiles over 13,692 catalog entries.

## Zero-support frames

The current packaged profile projection produces no lexical entry with:

```text
serial-verb
causative
resultative
```

These labels therefore cannot currently supply lexical evidence to any grammar slot.

## Fully dead valency slots

Two current grammar slots accept only unsupported frames:

### `clause.causative:predicate`

```text
required: [causative]
supported entries: 0
```

This makes the current dedicated causative Clause production lexically unreachable through the packaged profile system.

### `complement.result:result`

```text
required: [resultative]
supported entries: 0
```

The dedicated result complement path is likewise lexically unreachable under the current profile projection.

## Mixed-support slots

These rules remain executable, but one construction-specific frame contributes no lexical support:

### `clause.ba:predicate`

```text
required: ambitransitive | resultative | transitive
supported: ambitransitive | transitive
unsupported: resultative
supported entries: 2,103
```

The BA rule can execute, but never because a lexical profile is `resultative`.

### `clause.pivotal:predicate`

```text
required: ambitransitive | causative | transitive
supported: ambitransitive | transitive
unsupported: causative
supported entries: 2,103
```

The current pivotal rule can execute without any causative-profile evidence.

### `clause.serial-verb:firstPredicate`
### `clause.serial-verb:secondPredicate`

Each slot currently accepts:

```text
ambitransitive | intransitive | serial-verb | transitive
```

but only the ordinary valency frames have packaged support. The `serial-verb` alternative itself has zero entries. Each slot has 4,529 entries through the ordinary fallback frames.

Therefore current reachability of `clause.serial-verb` is not evidence that the system has identified serial-verb lexical capability; the rule is effectively an arbitrary two-VerbPhrase construction over broadly ordinary verb profiles.

## Migration implications

1. `clause.causative` must remain in the v2 `hold-for-corpus-rebuild` state; its current dedicated valency contract is dead.
2. `complement.result` needs a new dependency-pattern/evidence derivation before it can be claimed as an executable resultative complement.
3. `clause.serial-verb` must not be treated as corpus-grounded merely because the rule is structurally reachable; its named `serial-verb` frame contributes zero support.
4. `clause.pivotal` reachability is not causative evidence; its causative alternative contributes zero support.
5. The `resultative` alternative in BA is currently decorative. BA reachability comes from ordinary transitive/ambitransitive profiles.
6. Do not assign sampling mass to these named construction capabilities until their evidence derivation is explicit.

## Reproduction

Run:

```sh
npx tsx scripts/audit-valency-reachability.ts
```

The audit distinguishes zero-support requirement slots from mixed fallback slots so a broad fallback cannot disguise a missing construction-specific evidence path.
