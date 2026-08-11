# Input-order runtime integration

The v2 runtime migration preserves one hard boundary: production curriculum and formal-syntax selection consume a small binding-evidence contract directly from Measurement V2 semantic aggregates. Canonical structural adjacency remains available to legacy/research selection, but it is not projected from Measurement V2 motor evidence and the production selector has no transition input channel.

The product integration therefore proceeds in this order:

1. switch product session state to `InteractionSessionStateV2`;
2. derive and aggregate `measurement-v2` observations at round completion;
3. pass V2 semantic binding aggregates directly through the curriculum-owned learner-evidence contract;
4. keep persistence on the V2 measurement epoch and reset strict-order legacy measurement evidence during migration;
5. render practice with a current syllable whose body components may complete independently before tone commit;
6. keep legacy `MeasurementSummary` only for research/simulation consumers that still define legacy binding/transition semantics.

The production path does not rebuild `MeasurementSummary`, manufacture legacy observation counts, or attach legacy timing-exclusion fields before selection. This keeps Measurement V2 storage identity and motor families out of curriculum policy while allowing legacy research APIs to migrate independently.
