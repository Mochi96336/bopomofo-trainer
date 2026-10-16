import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  validateDongxiUdTrainReviewQueue,
  validateDongxiUdReviewerHandout,
  PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA,
} from "../src/readings/dongxi-ud-review-queue.js";
import type { DongxiUdCorpus } from "../src/readings/dongxi-ud-intake.js";

const source = JSON.parse(await readFile(
  "data/readings/dongxi-ud-gsd-attested-review-candidates.json", "utf8",
)) as DongxiUdCorpus;
const packet = JSON.parse(await readFile(
  "data/readings/dongxi-ud-gsd-train-review-queue.json", "utf8",
)) as unknown;
const report = validateDongxiUdTrainReviewQueue(packet, source);
const handout = await readFile("docs/reviewer-packets/dongxi-gsd-train-independent-review-form.md", "utf8");
const handoutBlobSha = createHash("sha1")
  .update(`blob ${Buffer.byteLength(handout, "utf8")}\0`)
  .update(handout, "utf8").digest("hex");
if (handoutBlobSha !== PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA) {
  throw new Error("reviewer handout differs from intentionally approved complete-document pin");
}
const handoutReport = validateDongxiUdReviewerHandout(handout, source);
console.log(JSON.stringify({
  schemaVersion: "dongxi-ud-train-review-queue-audit-v1",
  ...report,
  ...handoutReport,
  sourceSplit: "train",
  exposedDevTestUsedForLabels: false,
  readyForTraining: false,
  warning: "This is a generated BLANK review queue, not an independent human review or accuracy benchmark.",
}, null, 2));
