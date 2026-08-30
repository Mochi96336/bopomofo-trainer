# Formal Syntax V2 occurrence sidecar composition

Same-occurrence construction evidence remains separate from aggregate syntax profiles.

The causative finite-ccomp capability established the first reviewed sidecar. BA now adds a second independent sidecar with its own pinned-source evidence contract and identity-safe projection.

## Boundary

A single sidecar still applies only to clean source profiles:

```text
clean source profiles
  + one reviewed occurrence sidecar
  -> projected runtime profiles
```

For multiple reviewed constructions, the batch API composes sidecars against the same immutable source-profile artifact:

```text
clean source profiles
  + causative sidecar
  + BA sidecar
  + future reviewed sidecars
  -> runtime profiles with the union of explicit capabilities
```

Each artifact is validated independently for source-profile digest, pinned source metadata, reviewed capability, evidence contract, identity policy, profile identities, entry count, and determinism digest. A sidecar may add only its own reviewed capability, and the same capability cannot be projected twice onto one profile.

## BA ownership

BA capability is not reconstructed from generic `transitive`, `adpositional-complement`, marker identity, or base `obl` evidence. The authoritative proof is the reviewed same-occurrence contract:

`same-predicate-obl-patient-case-ba-v1`

The pinned source scan requires one predicate occurrence to own an exact `obl:patient` whose direct `case` child is reviewed `把` or `將`. Runtime packaging then joins those reviewed form+UPOS source keys to active profiles under the unique-active-entry identity policy.

This slice packages evidence only. It does not change `clause.ba`, activate BA practice, or change product sampling probability.