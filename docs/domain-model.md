# Domain Model

## Scope

The production architecture is intentionally Bopomofo-specific. It supports one semantic writing system with multiple physical keyboard layouts. It does not attempt to make Pinyin, Cangjie, or unrelated input methods fit the same interaction grammar.

The central input-order rule is:

```text
canonical linguistic order
≠ accepted input order
≠ observed motor order
```

These three orders may coincide, but no layer may assume they are identical.

## Prompt

Human-readable Chinese context shown to the learner.

```ts
interface Prompt {
  text: string;
  locale: "zh-TW";
}
```

The prompt is context, not the measured answer by itself.

## Practice mode

```ts
type PracticeMode = "guided" | "recall";
```

- `guided`: Chinese context and complete Bopomofo reading are visible.
- `recall`: Bopomofo is hidden or partially hidden; retrieval time must remain statistically separate from guided motor evidence.

The current product implements guided practice.

## Token

A token is the smallest semantic unit in a Bopomofo reading. It is not a physical key.

Examples:

- `zhuyin:ㄓ`
- `zhuyin:ㄨ`
- `zhuyin:ㄥ`
- `tone:1`

```ts
type TokenId = string;

interface TokenDefinition {
  id: TokenId;
  label: string;
  kind: "bopomofo" | "tone";
}
```

Initial, medial, and final roles belong to a syllable parse rather than permanent token identity.

## Syllable

A `Syllable` stores the **canonical semantic representation** of a reading.

```ts
interface Syllable {
  tokens: readonly TokenId[];
}
```

For example:

```text
ㄒ ㄩ ㄝ ˊ
```

may be stored canonically as:

```text
[ㄒ, ㄩ, ㄝ, tone:2]
```

This ordered array supports stable catalog identity, parsing, display, and structural linguistic relations. **Its array order is not an input cursor.**

Invariants:

- every syllable contains exactly one tone token;
- the tone token is canonically final;
- first tone is represented explicitly as `tone:1`;
- physical key codes never appear in a syllable;
- legal Bopomofo structure is validated by the reading parser.

## Catalog entry

```ts
interface CatalogEntry {
  id: string;
  prompt: Prompt;
  syllables: readonly Syllable[];
  tags: readonly string[];
  provenanceIds: readonly string[];
}
```

A catalog entry is content, not automatically one whole on-screen exercise.

## Exercise

```ts
interface Exercise {
  id: string;
  mode: PracticeMode;
  layoutId: string;
  entries: readonly CatalogEntry[];
}
```

An exercise retains entry and syllable boundaries while allowing continuous practice across several words.

## Input layout

```ts
interface InputLayout {
  id: string;
  name: string;
  bindings: Readonly<Record<string, TokenId>>;
}
```

A layout maps `KeyboardEvent.code` to semantic tokens. Physical ergonomics such as assigned hand belong to physical-key metadata, not to a Bopomofo token, because the same token may move under another layout.

## Accepted input plan

Before interaction, the canonical exercise is compiled into an `ExerciseInputPlan`.

Each syllable becomes:

```text
body slots + explicit tone commit
```

For canonical `ㄒ ㄩ ㄝ ˊ`, the body slots are the three non-tone components. The learner may complete those body slots in any order. The tone becomes available only after every body slot is complete.

Canonical token indices are retained as provenance for display and structural analysis, but they do not determine which body token is currently legal.

## Interaction state

`InteractionSessionStateV2` tracks:

- the compiled input plan;
- the current syllable ordinal;
- which body slot IDs are complete;
- total completed slots;
- raw `InteractionTraceV2` events;
- recovery/error state;
- session completion.

There is deliberately no single `position` that means “the one legal token” while several body slots remain.

## Interaction trace

A V2 trace records what the system actually knows about one input event.

Important distinctions include:

```text
actualToken
matchedToken / matchedSlot
attributedExpectedToken
acceptedOrdinalInSyllable
outcome
accepted
context
```

`attributedExpectedToken` is nullable. If two or more body components remain and the learner presses some other mapped token, the system does not pretend to know which remaining token was intended.

Interaction context is derived from actual accepted order:

- `exercise-start`
- `entry-start`
- `syllable-start`
- `within-syllable`
- `tone`

The token that is canonically first is not automatically the runtime `syllable-start` event.

## Semantic evidence

### Binding

Binding identity remains:

```text
practice mode + layout ID + token ID
```

A matched token creates successful binding evidence. A mapped error creates token-specific failure evidence only when the expected token is unambiguous.

### Confusion

Confusion identity is:

```text
practice mode + layout ID + expected token + actual token
```

A confusion exists only when the expected token can be attributed without guessing. Ambiguous errors, duplicate components, and premature tones are retained separately.

## Motor evidence

Motor evidence comes only from actual interaction order.

### Syllable coordination

Measures the time span needed to complete all body components of one syllable, independent of which legal body order was used.

### Immediate hand transition

Uses consecutive accepted physical events and their assigned hands. Its coarse aggregate space is only:

```text
L→L, L→R, R→L, R→R
```

### Same-hand revisit

Links an accepted event to the previous accepted event assigned to the same hand, even if events from the other hand occurred in between. It is a revisit/preparation interval, not a claim that the two keys were consecutive.

### Tone commit

Measures from the final accepted body component to the accepted tone commit.

## Structural relations

Canonical adjacency is linguistic/catalog structure, not motor evidence.

`StructuralAdjacencyOccurrence` may represent canonical neighbors such as:

```text
ㄒ → ㄩ
ㄩ → ㄝ
ㄝ → tone:2
```

A learner may physically type the same syllable body in reverse order. Therefore structural adjacency and observed motor order use separate types and separate pipelines.

The older relational research subsystem retains historical `transition` terminology for compatibility. New production code must use explicit structural or motor vocabulary.

## Aggregation rule

Raw observations may contain rich context, but aggregate identities must remain intentionally low-dimensional. Token, physical code, hand, boundary, finger, and syllable features are not automatically multiplied together.

Current motor aggregate bounds are:

- immediate hand: at most 4 scopes;
- same-hand revisit: at most 4 scopes;
- coordination: at most 12 scopes;
- tone commit: tone identity only.

This keeps sample density meaningful and prevents combinatorial skill-state growth.

## Product persistence

Product progress schema 7 uses measurement epoch:

```text
coordination-v1
```

Legacy schema 6 identity/history may migrate, but old strict-order measurement evidence is reset because it may contain false errors, false confusions, and canonical token-pair transitions that are not valid under the new semantics.

## Curriculum boundary

Current adaptive selection may use semantic binding evidence. Motor aggregates are diagnostic-only.

A future motor objective must state how practice actually elicits the targeted motor behavior. The presence of a canonical token pair inside a word is not enough to guarantee that a learner will type that pair consecutively.

## Identity rules

- catalog entry IDs remain stable when frequency metadata changes;
- binding statistics are scoped by mode, layout, and token;
- confusion statistics require an unambiguous expected token;
- physical key codes and assigned hand belong to interaction/motor evidence, never catalog readings;
- canonical structural adjacency does not update motor timing;
- recall-mode evidence must not silently contaminate guided-mode evidence.

## Open questions

- whether motor coordination should eventually influence curriculum selection;
- whether exact physical-key or finger-level motor models earn enough samples to be useful;
- whether keyup/overlap traces add useful information about rolling strategies;
- how stable individual input-order preferences become over time;
- how best to model words with multiple accepted readings and regional variants.
