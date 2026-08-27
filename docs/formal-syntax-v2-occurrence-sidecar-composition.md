# Formal Syntax V2 occurrence sidecar composition

The first reviewed runtime occurrence capability was causative finite-ccomp, so the original projection API only needed to join one sidecar onto clean aggregate syntax profiles.

BA and passive require their own independent same-occurrence evidence contracts. Those capabilities must not be reconstructed by widening the causative artifact or by ANDing aggregate syntax facts.

## Boundary

The single-artifact API remains strict:

```text
clean source profiles
  + one reviewed occurrence sidecar
  -> projected runtime profiles
```

It still rejects a source profile that already contains occurrence capabilities.

A separate batch API now supports:

```text
clean source profiles
  + reviewed sidecar A
  + reviewed sidecar B
  + ...
  -> runtime profiles with the union of explicitly projected capabilities
```

Every sidecar is validated independently against the same immutable source-profile artifact digest. Previously projected capabilities are preserved; the same reviewed capability cannot be projected twice onto the same profile.

## Current behavior

This slice does not add a second capability, change the current causative artifact format, regenerate runtime data, or switch product compilation to multiple sidecars. With the current single causative artifact, behavior is unchanged.

The purpose is only to make a future BA or passive sidecar additive rather than forcing construction evidence into one hard-coded aggregate artifact.
