# ADR 0003: Start local-first without a backend

- Status: Accepted
- Date: 2026-07-19

## Context

The interaction spike and first product need only local catalog data, short event traces, learner profiles, and session summaries. Accounts, synchronization, and social features are not required to validate the training method.

The measurement policy is still experimental, so permanent storage should not force an early raw-event or aggregation schema.

## Decision

The initial architecture has no server dependency.

The disposable interaction spike keeps raw traces in memory and may display or download them for inspection. It does not create permanent learner progress.

After measurement semantics stabilize, persistence is represented behind a small interface. A product prototype may begin with browser-local storage. IndexedDB is introduced only if the product retains raw observations, large session histories, multiple catalogs, or recomputable metrics.

> **Note, 2026-07-31.** The phased plan above was followed and the first paragraph now describes a phase that has passed: the browser does create permanent learner progress, schema-versioned in local storage alongside Pilot history and bounded progress trends, with backup export and import. Still no backend and still no IndexedDB, so the decision itself holds. The "disposable spike" framing it shares with ADR 0002 and ADR 0006 is retired by [ADR 0007](./0007-structure-the-app-shell.md).

## Consequences

Positive:

- no deployment, authentication, privacy, or database burden;
- the spike and product prototype can work offline;
- experimental traces are not silently treated as durable progress;
- progress remains private by default;
- storage technology can follow actual data requirements.

Costs:

- early traces require explicit export when they need to be retained;
- progress does not initially synchronize across devices;
- browser data can be lost unless export/import is later added;
- future accounts require a deliberate migration design.