# Input-order runtime integration

The v2 runtime migration must preserve one hard boundary: legacy selection code may consume a binding-only compatibility view, but canonical structural adjacency must never be projected into motor transition statistics.

The product integration therefore proceeds in this order:

1. switch product session state to `InteractionSessionStateV2`;
2. derive and aggregate `measurement-v2` observations at round completion;
3. expose only v2 binding evidence to existing frequency-first selection;
4. move persistence to schema 7 and reset legacy measurement evidence during migration;
5. update practice rendering to show a current syllable with independently completed body components and a tone commit state;
6. migrate history/diagnostic readers to v2 observations before removing legacy measurement dependencies.
