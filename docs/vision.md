# Vision

## Problem

Most typing trainers assume that the prompt, the learned unit, and the physical key are the same thing. Bopomofo practice has distinct layers:

1. Chinese context, such as `中文`;
2. an ordered semantic path, such as `ㄓ ㄨ ㄥ tone:1 | ㄨ ㄣ tone:2`;
3. a physical layout mapping, such as `Digit5 KeyJ Slash Space | KeyJ KeyP Digit6`;
4. learner relations over bindings, transitions, and directional confusions.

A useful research environment must preserve all four layers and retain the exact text occurrences that provide evidence for each relation.

## Thesis

The project builds a local-first Bopomofo trainer over reviewed Traditional Chinese text, and keeps the relational structures that make its evidence explainable.

The core structures are:

- binding nodes: visible token to layout-specific key correctness;
- transition edges: directional clean movement between adjacent tokens inside one syllable;
- confusion edges: directional expected-to-actual substitutions;
- catalog paths: ordered text-derived token sequences that support those relations.

The browser is one observation adapter over these structures rather than the definition of them.

## Core loop

1. compile reviewed text and explicit Bopomofo readings;
2. index exact binding and transition occurrences and possible confusion contrasts;
3. constrain candidates to grammar-valid utterances under the formal production grammar;
4. select one utterance from reviewed commonness plus bounded, capped learner evidence;
5. record ordinary input traces in the browser;
6. aggregate them through the measurement policy into binding, transition, and confusion estimates;
7. project those estimates into diagnostics the learner can read and question.

Grammar legality, candidate selection, and measurement remain separate policies so each can be changed and tested on its own.

A synthetic-learner and cohort-experiment arm was built to compare curriculum strategies against known latent skill. It is archived: no candidate strategy survived confirmation, and none reached production. See `docs/archive/`.

## Practice modes

### Guided mode

Chinese context and the complete Bopomofo reading are visible. Binding errors represent symbol-to-key mapping. Clean within-syllable inter-key latency represents directional transition evidence.

### Recall mode

Bopomofo is hidden or progressively revealed. Pronunciation retrieval is added to the task and must remain statistically separate. Recall remains deferred.

## First relational scope

- Traditional Chinese words and short phrases with explicit Bopomofo and all five tones;
- Taiwan Standard Bopomofo layout;
- binding, transition, and confusion identities scoped by mode and layout;
- exact within-syllable adjacency only for transition evidence;
- catalog provenance, frequency, and lexical tags;
- deterministic seeded selection;
- no fixed exercise word count.

## A note on timing evidence

A destination token's timing is not treated as an identifiable intrinsic token speed. The same clean interval is more naturally evidence for the incoming transition edge, which is why binding timing and transition timing stay separate aggregates rather than being merged.

## Non-goals

- accounts, cloud sync, telemetry, or backend services;
- candidate selection or IME prediction quality;
- mobile soft keyboards and device-specific optimization;
- generated pseudo-words, unless introduced as a separately labeled experiment;
- any claim that simulation, or the product's own diagnostics, prove real learning effectiveness.

## Validation layers

### Catalog structure

- every syllable ends with an explicit tone;
- ordered relation occurrences are reproducible;
- unsupported and concentrated relations are visible.

### Estimation behavior

- traces recover binding correctness, confusion direction, and transition latency with measurable error against latent truth;
- boundary, noise, and recovery effects remain separate;
- identical inputs and seeds produce identical reports.

### Curriculum behavior

- injected weaknesses are identified with explainable delay;
- target exposure increases without pathological repetition or lexical concentration;
- different objective and composition policies can be compared independently;
- unsupported objectives produce explicit fallback rather than fabricated evidence.

### Human usefulness

Untested. A local human pilot has not yet been run. It will observe whether the selected text sequences correspond to real learning and comfortable interaction; it does not get to define the architecture in advance, and no current claim depends on it.
