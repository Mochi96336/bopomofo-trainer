# Browser bundle attribution

Baseline: `main@9bf4c599476ce38c4f50b004cc587f6db86dae79`.

Run:

```bash
npm run build
npm run size:attribution
```

The ordinary production build at this baseline is:

- JavaScript: **467.3 kB gzip / 2,193.4 kB raw**
- complete site: **480.1 kB gzip / 2,266.3 kB raw**
- JavaScript budget use: **95.7%**
- total bundle budget use: **95.3%**

The generated browser catalog contains **13,692 current syntax-legal practice entries** and **16,061 runtime syntax profiles**.

## Rendered module ownership

Rollup's pre-minification rendered-module ownership is:

| Category | Rendered size | Share |
| --- | ---: | ---: |
| generated catalog | 2,855.2 kB | 87.0% |
| formal syntax / selection | 174.9 kB | 5.3% |
| product runtime | 99.8 kB | 3.0% |
| app shell | 76.4 kB | 2.3% |
| Analysis V2 | 74.2 kB | 2.3% |
| other runtime | 1.0 kB | ~0% |
| bootstrap / shared | 1.5 kB | ~0% |
| total | 3,283.1 kB | 100% |

These are ownership shares before final minification and gzip. They are useful for locating where shipped code/data comes from; they must not be added to or compared byte-for-byte with the final gzip total.

## Generated catalog payload split

The generated catalog itself can be split more concretely because its large encoded literals are independently measurable:

| Payload | Isolated gzip | Raw |
| --- | ---: | ---: |
| practice entries | 304.1 kB | 1,479.2 kB |
| runtime syntax profiles + compact key dictionaries | 94.5 kB | 487.8 kB |
| combined | 398.6 kB | 1,967.0 kB |

The two isolated gzip figures are diagnostic, not additive estimates of their exact contribution inside the final single JS bundle: cross-payload compression changes when everything is concatenated. Raw size and Rollup ownership both point to the same conclusion.

## Decision

The primary bundle-growth risk is **catalog data**, not Analysis V2 or the app shell.

Before another broad lexicon expansion:

1. measure the candidate with `npm run size:attribution`;
2. report practice-entry growth and runtime-profile growth separately;
3. treat syntax-profile payload growth as a first-class cost, not as free metadata attached to entries;
4. do not remove Analysis V2 merely to create token budget for catalog expansion — its rendered ownership is only about 2.3%;
5. if the hard budget must move, record why the added catalog coverage is worth the download cost.

The attribution command is intentionally manual. The ordinary PR gate remains the simpler hard bundle budget; attribution is for changes where understanding growth matters.
