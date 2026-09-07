# Local CTB xcomp controller evidence probe

## Why this probe exists

The current Formal Syntax V2 grammar distinguishes subject-control and object-control `xcomp` shapes, but the pinned `UD_Chinese-GSD r2.18` source cannot type the controller. Its basic trees contain `xcomp`; its Enhanced UD layer does not contain the `nsubj:xsubj` links required by the existing reviewed controller contract.

Penn Chinese Treebank (CTB) supplies a different source-native signal. The official bracketing guidelines define `(-NONE- *PRO*)` as the null subject used in control constructions and state that, when an infinitival IP is a complement, subject-control `*PRO*` is coindexed with the matrix subject and object-control `*PRO*` with the matrix object. The guideline examples use `IP-OBJ` complement clauses and identity indexes such as `NP-PN-SBJ-1` / `*PRO*-1` and `NP-PN-OBJ-1` / `*PRO*-1`.

References:

- CTB bracketing guideline: <https://catalog.ldc.upenn.edu/docs/LDC2009T24/treebank/chinese-treebank-parses.pdf>
- Chinese Treebank 9.0 catalog entry: <https://catalog.ldc.upenn.edu/LDC2016T13>

## Licensing boundary

CTB 9.0 (`LDC2016T13`) is an LDC-distributed licensed corpus. This repository does **not** download, vendor, redistribute, or commit CTB source text.

The probe accepts only a caller-supplied local source directory. `data/external/` is already gitignored, so a licensed local copy may be placed there if desired, but the probe does not require a repository-local path.

## Evidence contract

The probe uses the contract `ctb-ip-obj-pro-coindex-controller-v1`.

A tree is a controller-typed open-complement candidate only when all structural conditions below hold:

1. the embedded subject contains `(-NONE- *PRO*-N)`;
2. that null element is inside `NP-SBJ`;
3. the embedded clause is an `IP-OBJ` selected directly by a matrix `VP`;
4. exactly one matrix argument outside the embedded IP carries the same identity index `N`;
5. `NP-...-SBJ-N` classifies subject control;
6. `NP-...-OBJ-N` classifies object control.

Zero or multiple same-index matrix arguments fail closed as `unresolved`. An unindexed `*PRO*` is also `unresolved` even when an object is present. This deliberately preserves the existing rule that `object + open complement` is not, by itself, object-control evidence.

`IP-ADV`, `IP-SBJ`, and other non-`IP-OBJ` PRO clauses are not counted as xcomp-controller candidates. This prevents arbitrary, subject, or adjunct control structures from being projected into the lexical open-complement capability.

For a later lexical projection, the probe also records whether the selected matrix VP exposes exactly one direct `VV` head. Subject/object observations without that head remain controller-typed evidence but are excluded from the `projectable*ControllerCount` fields.

## Running the probe

With a legally licensed CTB 9.0 bracketed tree directory available locally:

```bash
python scripts/audit-ctb-xcomp-controller-evidence.py \
  --source-dir data/external/ctb/9.0
```

The default recursive file pattern is `*.fid`. A different layout can be inspected with `--glob`:

```bash
python scripts/audit-ctb-xcomp-controller-evidence.py \
  --source-dir /path/to/ctb9 \
  --glob '*.fid' \
  --output /tmp/ctb-xcomp-controller-audit.json
```

The JSON output contains only aggregate/source-integrity fields:

- `sourceFileCount`
- `treeCount`
- `controlCandidateCount`
- `subjectControllerCount`
- `objectControllerCount`
- `unresolvedCount`
- `projectableSubjectControllerCount`
- `projectableObjectControllerCount`
- `unindexedProCount`
- `missingMatrixHeadCount`
- `sourceDigest`
- `determinismDigest`

It does not emit sentence text, lexical rows, or controller identities.

## What this slice does not do

This is a source-capability measurement probe only. It does not:

- add subject-control or object-control runtime capabilities;
- change active syntax profiles;
- make `clause.xcomp-subject-control` or `clause.xcomp-object-control` reachable in product;
- infer controller type from lexical meaning or hand-written verb lists;
- infer object control from a basic object plus embedded clause;
- change product probability, Measurement V2, or progress state.

A later slice may project controller-typed lexical identities only after a licensed full-source run is reviewed for counts, unresolved cases, head extraction, identity ambiguity, and source fingerprint stability.
