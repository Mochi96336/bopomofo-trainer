# Input order model v2

## Purpose

Bopomofo catalog readings have a canonical semantic order, but practice input does not need to use that order as a keystroke cursor. The v2 architecture therefore separates three orders that the original interaction model treated as one sequence.

1. **Canonical order** — the stable linguistic/catalog representation of a syllable.
2. **Accepted order** — the order in which the practice engine allows the learner to complete that syllable.
3. **Observed order** — the physical order in which accepted keyboard events actually occurred.

The architecture is deliberately broader than the first implementation. The first implementation only adds syllable-body coordination and coarse hand-based motor observations; it does not yet build a complete linguistic and motor graph system.

## Invariants

### Canonical order never defines the input cursor

`Syllable.tokens` remains ordered. It is still the source of truth for parsing, display, catalog identity, and future linguistic relations.

Interaction code must not interpret `tokens[i + 1]` as the only legal next physical input.

### Structural adjacency is not motor transition

Adjacency in a canonical Bopomofo representation describes structure. A motor transition describes two physical inputs that actually happened consecutively.

These concepts must not share a measurement type or aggregate merely because strict input order once made them numerically identical.

### Observations may be rich; aggregate identities stay intentionally low-dimensional

Raw or derived observations may retain token, physical code, hand, boundary, and timing context together. Aggregate keys must not automatically form the Cartesian product of those features.

The first motor aggregates are intentionally bounded:

- immediate hand transition: `L→L`, `L→R`, `R→L`, `R→R`;
- same-hand revisit: hand plus a coarse opposite-hand-intervened class;
- syllable coordination: body size plus coarse hand shape;
- tone commit: tone identity.

Exact token-pair and exact physical-key-pair motor skills are not part of v1 of this model.

## Layers

### Canonical / linguistic

Existing catalog types remain canonical:

```text
CatalogEntry
  └─ Syllable.tokens = [body..., tone]
```

The ordered token list must not be converted to a set.

### Acceptance

`compileExerciseInputPlan()` compiles canonical syllables into interaction plans:

```text
SyllableInputPlan
  ├─ bodySlots[]
  └─ toneSlot
```

`canonicalTokenIndex` is retained on every slot for display, provenance, and future linguistic analysis. It does not imply accepted input order.

The interaction v2 state machine will allow unfinished body slots to be completed in any order and will use the tone as an explicit commit step.

### Observed interaction

Interaction trace v2 will record what happened rather than reconstructing a canonical sequence after the fact.

A successful event identifies the slot it matched. A failed event only receives an attributed expected token when the state makes that intent unambiguous. In particular, when multiple body slots remain, an unexpected token must not be converted into an arbitrary expected-to-actual confusion pair.

### Motor metadata

Hand assignment belongs to `KeyboardEvent.code`, not `TokenId`.

```text
physicalCode ── keyboard geometry ──> assigned hand
      │
      └── active InputLayout ───────> semantic token
```

`assignedHand` is a conventional touch-typing assignment, not a claim about which hand the learner physically used. Space is therefore `ambiguous`, and unsupported physical keys are `unknown`.

## First implementation scope

The first usable v2 implementation will measure:

1. semantic token binding;
2. conservatively attributable confusion;
3. syllable-body coordination span;
4. immediate accepted-event hand transition;
5. same-hand revisit interval;
6. tone commit latency.

Motor observations remain diagnostic-only at first. Curriculum continues to use binding evidence until a separate design establishes which motor observations can be deliberately elicited by item selection.

## Same-hand continuity and boundaries

The raw accepted-event stream is physically continuous. The previous accepted event for a hand may therefore come from an earlier syllable or entry.

Boundary metadata is retained separately. Crossing an entry boundary does not erase the predecessor pointer, but measurement policy may exclude that sample from a motor baseline.

This keeps raw truth continuous while allowing measurement policy to remain conservative.

## Deferred work

The foundation intentionally does not implement:

- finger assignment;
- key distance or geometry cost;
- keyup/overlap analysis;
- exact token-pair motor aggregates;
- exact physical-key-pair motor aggregates;
- personal input-order preference learning;
- motor-driven curriculum;
- onset/rime linguistic boundary objectives;
- cross-round same-hand continuity.

Those features may be added without changing the three-order separation above.
