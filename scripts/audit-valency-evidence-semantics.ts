import { readFile } from "node:fs/promises";
import { auditValencyEvidenceSemantics } from "../src/syntax/valency-evidence-semantics-audit.js";
import type { SyntaxEvidenceArtifact } from "../src/syntax/profile-projection.js";

const artifactPath = process.argv[2];
if (artifactPath === undefined || artifactPath.length === 0) {
  throw new Error(
    "usage: npx tsx scripts/audit-valency-evidence-semantics.ts <ud-syntax-evidence.json>",
  );
}

const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as SyntaxEvidenceArtifact;
console.log(JSON.stringify(auditValencyEvidenceSemantics(artifact), null, 2));
