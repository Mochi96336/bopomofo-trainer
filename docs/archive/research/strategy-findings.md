# Relational strategy findings

- Source plan: `relational-cohort-v1`
- Source report digest: `fda70e4d`
- Analysis policy: `phase-7g-v2`
- Analysis digest: `973b24fc`
- Baseline cell: `["strategy-cell","binding-only-baseline","binding-preserving-baseline-v1","fixed-six-baseline","synthetic-relational-v1"]`
- Maximum blocking fallback rate: 0.2500

Bootstrap objective fallbacks remain in the raw fallback totals and clusters, but the versioned policy does not treat the declared round-zero codes as blocking candidate evidence.

## Recommendation counts

- Candidate: 2
- Inconclusive: 5
- Rejected: 368
- Zero executable rounds: 0

| Scenario | Candidate | Inconclusive | Rejected |
|---|---:|---:|---:|
| asymmetric-confusion | 1 | 1 | 123 |
| weak-binding | 1 | 1 | 123 |
| weak-transition | 0 | 3 | 122 |

## Candidate cells

- **asymmetric-confusion** — `frequency-random` / `binding-preserving-baseline-v1` / `fixed-six-baseline` / `synthetic-relational-v1`; blocking fallback 0; material-improvement:weaknessIdentificationDelayRounds
- **weak-binding** — `binding-only-baseline` / `relation-support-preserving-v1` / `fixed-six-baseline` / `synthetic-relational-v1`; blocking fallback 0.2500; material-improvement:bindingEstimateMeanAbsoluteError

## Global failure clusters

No failure cluster was recorded.

## Global fallback clusters

- `objective:combined-includes-support-driven-round-zero-demand` — 150 rounds across 150 runs.
- `objective:round-zero-frequency-support-sampling` — 150 rounds across 150 runs.
- `objective:round-zero-support-driven-binding` — 150 rounds across 150 runs.
- `objective:round-zero-support-driven-confusion` — 150 rounds across 150 runs.
- `objective:round-zero-support-driven-transition` — 150 rounds across 150 runs.
- `objective:combined-includes-unmeasured-support-driven-demand` — 140 rounds across 140 runs.
- `objective:unmeasured-support-driven-confusion` — 140 rounds across 140 runs.
- `objective:unmeasured-support-driven-binding` — 116 rounds across 116 runs.

## Balanced axis overview

| Axis | Level | Balanced | Total fallback | Blocking fallback | Failure | Weakness delay | Coverage | Cost/improvement |
|---|---|---|---:|---:|---:|---:|---:|---:|
| composition | `bounded-beam-search` | yes | 0.7900 | 0.2900 | 0 | 0.1532 | 0.2253 | 38.9646 |
| composition | `diversity-aware-greedy` | yes | 0.7633 | 0.2633 | 0 | 0.1696 | 0.2247 | 39.6580 |
| composition | `fixed-six-baseline` | yes | 0.7467 | 0.2467 | 0 | 0.1364 | 0.2193 | 39.9459 |
| composition | `greedy-gain-per-token` | yes | 0.7633 | 0.2633 | 0 | 0.1826 | 0.2253 | 39.9499 |
| composition | `greedy-marginal-gain` | yes | 0.7567 | 0.2567 | 0 | 0.2054 | 0.2220 | 39.9061 |
| learner | `synthetic-relational-v1` | yes | 0.7640 | 0.2640 | 0 | 0.1696 | 0.2233 | 39.6849 |
| objective | `binding-only-baseline` | yes | 0.8867 | 0.3867 | 0 | 0.5798 | 0.1987 | 38.0575 |
| objective | `combined-relational` | yes | 0.9667 | 0.4667 | 0 | 0 | 0.4647 | 38.2174 |
| objective | `confusion-aware` | yes | 0.9667 | 0.4667 | 0 | 0 | 0.1000 | 42.4766 |
| objective | `frequency-random` | yes | 0.5000 | 0 | 0 | 0.2857 | 0.1860 | 42.1354 |
| objective | `transition-aware` | yes | 0.5000 | 0 | 0 | 0 | 0.1673 | 37.5378 |
| partition | `binding-preserving-baseline-v1` | yes | 0.7667 | 0.2667 | 0 | 0.1696 | 0.2240 | 40.0025 |
| partition | `commonness-stratified-v1` | yes | 0.7600 | 0.2600 | 0 | 0.1983 | 0.2247 | 39.7167 |
| partition | `path-novelty-v1` | yes | 0.7567 | 0.2567 | 0 | 0.1468 | 0.2247 | 39.4637 |
| partition | `relation-support-preserving-v1` | yes | 0.7867 | 0.2867 | 0 | 0.1712 | 0.2227 | 39.6676 |
| partition | `seeded-maximum-coverage-v1` | yes | 0.7500 | 0.2500 | 0 | 0.1607 | 0.2207 | 39.5740 |

## Interpretation boundary

- Synthetic strategy comparisons do not establish human learning effectiveness.
- Candidate means policy-compatible for this committed cohort, not a production recommendation.
- Axis summaries are descriptive factorial averages and are not causal effect estimates.
- All fallback rounds remain visible; only versioned round-zero bootstrap codes are non-blocking for candidate guardrails.
- Null metrics and failed runs remain visible and are never dropped from guardrails.
- Descriptive normal intervals are not inferential evidence for a human population.
