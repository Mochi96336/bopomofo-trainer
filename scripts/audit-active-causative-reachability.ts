import { readFile } from "node:fs/promises";
import { summarizeCausativeRuntimeReachability } from "./causative-runtime-reachability.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";

const artifact = JSON.parse(await readFile(
  new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url),
  "utf8",
)) as ActiveCatalogSyntaxProfilesArtifact;

if (artifact.runtimeMorphologyProjection?.reviewedFeature !== "Voice=Cau") {
  throw new Error("active runtime profiles do not carry reviewed Voice=Cau lineage");
}
if (artifact.runtimeMorphologyProjection.identityPolicy !== "unique-active-entry-per-form-upos-v1") {
  throw new Error("active runtime morphology identity policy is not the reviewed fail-closed policy");
}

console.log(JSON.stringify({
  sourceCommit: artifact.runtimeMorphologyProjection.sourceCommit,
  identityPolicy: artifact.runtimeMorphologyProjection.identityPolicy,
  ...summarizeCausativeRuntimeReachability(artifact.profiles),
}));
