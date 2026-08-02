# Development workflow

## Purpose

This repository uses a local-first development workflow. GitHub Actions is a final verification aid, not a remote development environment, and product work must not automatically execute the archived relational research suite.

## Local gates

Install dependencies once for the working tree:

```bash
npm ci --include=dev --ignore-scripts
```

Before pushing an ordinary product, catalog, grammar, measurement, UI, persistence, or documentation change, run:

```bash
npm run check:pr
```

This command runs:

1. catalog generation and TypeScript typecheck;
2. every Vitest test except `tests/relations/partition/real-catalog-policy.test.ts` (`test:fast` then `test:simulation`);
3. the Python source-adapter tests;
4. catalog validation;
5. the production build;
6. the bundle size budget.

The compiled catalog is almost the whole JavaScript bundle — around 450 kB of the
460 kB a visitor downloads — so the download grows with every entry added, and
the plan is to keep adding entries. `bundle-budget.json` holds the gzipped limit
per asset kind, plus a limit on the total. Going over is not a bug and the
failure does not read as one: it asks for the increase to be a decision, taken
and recorded in the same change, rather than absorbed quietly. Raise the limit
deliberately and say in the commit what grew.

An asset kind the build emits with no limit against it fails the check too. A
gate that only guards the kinds it already knows about would hold right up until
the build started emitting a font, a `.wasm` or a data file — which is the point
at which it was needed. Give the new kind a limit, or waive it in `unbudgeted`
with the reason. The total is the sum of the per-kind limits, so a new kind
cannot be paid for out of another kind's headroom either.

The one excluded file runs all five relational partition strategies over the complete active catalog and takes roughly five minutes on its own, which is why it is not a routine gate. Run it directly when a change touches relational partitioning:

```bash
npm run test:slow
```

Run the full archived research verification only when a change touches the simulation or canonical research surface, including `src/simulation/**`, `tests/simulation/**`, relational experiment scripts, experiment fixtures, or committed research findings:

```bash
npm run check:research
```

The research command is intentionally expensive. It is not a routine product merge gate.

## Browser tests

`check:pr` runs in jsdom, which reproduces a dialog's bookkeeping and none of its modality. The rules that depend on the platform itself — the top layer a native `<dialog>` opens into, which surface Escape belongs to when two are stacked, where focus lands afterwards, whether the page overflows at 320px — are checked in Chromium instead:

```bash
npx playwright install chromium   # once
npm run test:browser
```

It builds first and runs against the production build, since that is the artifact Pages deploys. The suite is deliberately small and stays that way: it holds what jsdom cannot answer, not a second home for assertions the unit tests already make better. Browser specs are named `*.browser.ts` so Vitest, which claims `*.test.ts` and `*.spec.ts` across the whole tree, never tries to run one in jsdom.

## GitHub Actions policy

- Pull requests run the fast `check` job and the `browser` job.
- Pushes to `main` run the same two jobs.
- Both belong to the `check` workflow, so the deploy gate — which waits on that workflow concluding successfully — covers the browser suite too.
- The `research` job runs only through `workflow_dispatch` with `run_research=true`.
- Concurrency is grouped by pull request or ref, and a newer run cancels the older run.
- Pages deployment is triggered only by a successful `check` run on `main`, and always deploys the commit that run checked.
- Its concurrency group is fixed (`pages`) so the newest deployment wins rather than whichever build happens to finish last, and it is declared on the deploy job rather than on the workflow — a group held at workflow level is entered by every run that starts, so a pull request's `check` completion, or a failed `check` on `main`, would cancel a live deployment and put nothing in its place.
- `Deploy Pages` has no `workflow_dispatch` of its own. Dispatching it could only pin a branch, never the fact that the branch's current commit had passed anything. **To deploy by hand, run the `check` workflow manually on `main`**; success carries it through to deployment.
- The fast jobs have a 20-minute timeout; the manually requested research job has a 60-minute timeout.
- While hosted Actions quota is unavailable, a pull request may be reviewed and merged from recorded local verification plus diff review. Do not push repeatedly to probe CI.

## Commit and pull-request discipline

- Prepare and inspect the complete change locally before the first push.
- Prefer one logical commit. Use at most one follow-up fix commit when new evidence requires it.
- Never create `noop`, placeholder, or accidental-file commits.
- Do not use one file update as one commit when the files form one change.
- Do not push solely to discover type errors or failing tests that can be found locally.
- Keep product work separate from archived research reruns.
- Record the exact local commands and their results in the pull-request description.
- Squash merge feature branches so `main` retains one intentional commit per completed change.

## Dependency lockfile

The reviewed `package-lock.json` is the installation contract for local development and CI. Use `npm ci` for ordinary setup and verification. Update the lockfile with `npm install` only when intentionally changing dependencies, and review that change together with `package.json`.

## Actions quota exhaustion

When GitHub-hosted Actions minutes are exhausted:

1. continue development locally;
2. run `npm run check:pr` before each push;
3. batch the completed change into one push;
4. attach the local verification result to the pull request;
5. defer `check:research` unless the research surface actually changed;
6. rerun the appropriate GitHub job once quota is restored, rather than replaying every historical commit.
