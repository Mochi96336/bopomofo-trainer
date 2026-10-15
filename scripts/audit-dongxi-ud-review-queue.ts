import { readFile } from "node:fs/promises";
import {
  validateDongxiUdTrainReviewQueue,
} from "../src/readings/dongxi-ud-review-queue.js";
import type { DongxiUdCorpus } from "../src/readings/dongxi-ud-intake.js";

const source = JSON.parse(await readFile(
  "data/readings/dongxi-ud-gsd-attested-review-candidates.json", "utf8",
)) as DongxiUdCorpus;
const packet = JSON.parse(await readFile(
  "data/readings/dongxi-ud-gsd-train-review-queue.json", "utf8",
)) as unknown;
const report = validateDongxiUdTrainReviewQueue(packet, source);
console.log(JSON.stringify({
  schemaVersion: "dongxi-ud-train-review-queue-audit-v1",
  ...report,
  sourceSplit: "train",
  exposedDevTestUsedForLabels: false,
  readyForTraining: false,
  warning: "This is a generated BLANK review queue, not an independent human review or accuracy benchmark.",
}, null, 2));
