# Archived research source

This tree contains research and compatibility modules that remain reproducible but are not part of the current browser/product runtime.

Rules:

- current browser/product code must not import from `src/archive/research/**`;
- archived research remains reachable through `src/research.ts` or explicit research scripts/tests;
- moving a module here is an ownership/path change, not permission to change its historical semantics;
- ordinary product code should depend on current Measurement V2, current selection, and current persistence contracts instead.

Physical migration is intentionally incremental. Only modules with verified non-product consumers should move here.

Currently archived here:

- legacy transition-aware frequency-first selection and slot-weighted grammar;
- relational research integration;
- relational objective contracts and strategy selection;
- the retired Phase 4 curriculum policy/state/focus/exercise/simulation/CLI stack.

Some research code remains outside this tree because it still provides contracts to active build/review tooling. In particular, `src/relations/**` is not a pure archive while reference contribution/ranking still consumes relational report types.
