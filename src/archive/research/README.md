# Archived research source

This tree contains research and compatibility modules that remain reproducible but are not part of the current browser/product runtime.

Rules:

- current browser/product code must not import from `src/archive/research/**`;
- archived research remains reachable through `src/research.ts` or explicit research scripts/tests;
- moving a module here is an ownership/path change, not permission to change its historical semantics;
- ordinary product code should depend on current Measurement V2, current selection, and current persistence contracts instead.

Physical migration is intentionally incremental. Only modules with verified non-product consumers should move here.
