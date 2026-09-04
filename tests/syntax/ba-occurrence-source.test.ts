import { describe, expect, it } from "vitest";
import {
  lexemeUposKey,
} from "../../scripts/ud-occurrence-source.js";
import {
  parseBaOccurrenceEvidence,
} from "../../scripts/ba-occurrence-source.js";

const BA_WITH_BA = [
  "# sent_id = ba",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t把\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t書\t_\tNOUN\t_\t_\t4\tobl:patient\t_\t_",
  "4\t拿走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const BA_WITH_JIANG = [
  "# sent_id = jiang",
  "1\t他\t_\tPRON\t_\t_\t4\tnsubj\t_\t_",
  "2\t將\t_\tADP\t_\t_\t3\tcase\t_\t_",
  "3\t書\t_\tNOUN\t_\t_\t4\tobl:patient\t_\t_",
  "4\t帶走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const PATIENT_WITHOUT_BA = [
  "# sent_id = patient-no-ba",
  "1\t書\t_\tNOUN\t_\t_\t2\tobl:patient\t_\t_",
  "2\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

const SPLIT_FACTS = [
  "# sent_id = patient-only",
  "1\t書\t_\tNOUN\t_\t_\t2\tobl:patient\t_\t_",
  "2\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = unrelated-ba",
  "1\t把\t_\tADP\t_\t_\t2\tcase\t_\t_",
  "2\t事情\t_\tNOUN\t_\t_\t3\tobl\t_\t_",
  "3\t處理\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("BA same-occurrence evidence", () => {
  it("requires the BA marker to be the case child of the exact obl:patient", () => {
    const evidence = parseBaOccurrenceEvidence(BA_WITH_BA);
    const key = lexemeUposKey("拿走", "VERB");

    expect(evidence.oblPatientPredicateTokenCount).toBe(1);
    expect(evidence.baMarkedPatientPredicateTokenCount).toBe(1);
    expect(evidence.baMarkedPatientPredicateCounts.get(key)).toBe(1);
    expect(evidence.markerCounts.get("把")).toBe(1);
  });

  it("accepts reviewed 將 as the alternate BA marker", () => {
    const evidence = parseBaOccurrenceEvidence(BA_WITH_JIANG);
    expect(evidence.baMarkedPatientPredicateCounts.get(lexemeUposKey("帶走", "VERB"))).toBe(1);
    expect(evidence.markerCounts.get("將")).toBe(1);
  });

  it("keeps exact obl:patient evidence separate when no BA marker is attached", () => {
    const evidence = parseBaOccurrenceEvidence(PATIENT_WITHOUT_BA);
    expect(evidence.oblPatientPredicateTokenCount).toBe(1);
    expect(evidence.baMarkedPatientPredicateTokenCount).toBe(0);
  });

  it("does not join patient evidence and a BA marker across occurrences", () => {
    const evidence = parseBaOccurrenceEvidence(SPLIT_FACTS);
    expect(evidence.oblPatientPredicateTokenCount).toBe(1);
    expect(evidence.baMarkedPatientPredicateTokenCount).toBe(0);
  });
});
