# ADR 0002: Keep the training core framework-independent

- Status: Accepted. The presentation-layer disposability clause is superseded by [ADR 0007](./0007-structure-the-app-shell.md).
- Date: 2026-07-19

## Context

The project has not yet validated its curriculum, measurement policy, or product interaction model. Coupling domain logic to components, DOM events, or browser storage would make those experiments harder to revise.

At the same time, a small human-operated browser spike is required before timing semantics can be finalized.

## Decision

The reusable core is plain TypeScript. Catalog compilation, exercise construction, session progression, measurement, and curriculum logic must remain callable without React, a browser, or persistent storage.

The first executable artifact may be a disposable web interaction spike. Its browser adapter and temporary presentation layer are not the domain core and may be replaced. Selection of a product UI framework remains deferred until the validated interaction requires one.

> **Superseded in part, 2026-07-31.** The clause that the presentation layer "may be replaced" no longer describes this project. No product UI framework was ever selected, and the spike became the product surface. [ADR 0007](./0007-structure-the-app-shell.md) retires the disposability of the browser layer and structures it in place instead.
>
> The rest of this decision stands unchanged, and is what makes that possible without a rewrite: the domain core is still plain TypeScript, still callable without a browser, and framework selection is still deferred — now indefinitely, since the project is distributed as a static page with no backend.

## Consequences

Positive:

- human interaction can be tested early without defining the permanent product stack;
- deterministic domain tests remain browser-independent;
- UI technology can change without rewriting the learning model;
- the project stays lightweight during concept validation.

Costs:

- adapters are needed for time, randomness, keyboard events, and persistence;
- the spike may contain intentionally temporary code;
- some types may initially feel more abstract than direct component state;
- UI convenience libraries cannot define the domain model.