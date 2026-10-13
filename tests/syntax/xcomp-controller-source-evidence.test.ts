import { describe, expect, it } from "vitest";
import {
  summarizeXcompControllerSourceEvidence,
} from "../../scripts/xcomp-controller-source-evidence.js";

const SOURCE = [
  "# sent_id = subject-control",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t3:nsubj:xsubj\t_",
  "2\t想\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t走\t_\tVERB\t_\t_\t2\txcomp\t_\t_",
  "",
  "# sent_id = object-control",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t叫\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t我\t_\tPRON\t_\t_\t2\tobj\t4:nsubj:xsubj\t_",
  "4\t走\t_\tVERB\t_\t_\t2\txcomp\t_\t_",
  "",
  "# sent_id = unresolved-object-plus-xcomp",
  "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
  "2\t看\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "3\t我\t_\tPRON\t_\t_\t2\tobj\t_\t_",
  "4\t走\t_\tVERB\t_\t_\t2\txcomp\t_\t_",
  "",
].join("\n");

describe("xcomp controller source evidence", () => {
  it("classifies only explicit enhanced external-subject controller edges", () => {
    const evidence = summarizeXcompControllerSourceEvidence([SOURCE]);
    expect(evidence.xcompCount).toBe(3);
    expect(evidence.subjectControllerCount).toBe(1);
    expect(evidence.objectControllerCount).toBe(1);
    expect(evidence.otherControllerCount).toBe(0);
    expect(evidence.unresolvedCount).toBe(1);
    expect(evidence.enhancedXsubjEdgeCount).toBe(2);
  });

  it("does not infer object control from basic obj + xcomp", () => {
    const evidence = summarizeXcompControllerSourceEvidence([SOURCE]);
    expect(evidence.basicObjectPlusXcompCount).toBe(2);
    expect(evidence.unresolvedBasicObjectPlusXcompCount).toBe(1);
  });

  it("retains deterministic structural occurrence identities without sentence text", () => {
    const evidence = summarizeXcompControllerSourceEvidence([SOURCE]);
    expect(evidence.occurrences).toEqual([
      {
        sourceIndex: 0,
        sentenceIndex: 0,
        matrixId: 2,
        xcompId: 3,
        controllerKind: "subject",
        controllerId: 1,
        matrixHasObject: false,
      },
      {
        sourceIndex: 0,
        sentenceIndex: 1,
        matrixId: 2,
        xcompId: 4,
        controllerKind: "object",
        controllerId: 3,
        matrixHasObject: true,
      },
      {
        sourceIndex: 0,
        sentenceIndex: 2,
        matrixId: 2,
        xcompId: 4,
        controllerKind: "unresolved",
        controllerId: null,
        matrixHasObject: true,
      },
    ]);
  });
});
