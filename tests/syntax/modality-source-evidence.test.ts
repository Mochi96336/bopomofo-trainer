import { describe, expect, it } from "vitest";
import { summarizeModalitySourceEvidence } from "../../scripts/modality-source-evidence.js";

const SOURCE = [
  "# sent_id = modal",
  "1\t會\t_\tAUX\t_\t_\t2\taux\t_\t_",
  "2\t走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = aspect",
  "1\t走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "2\t了\t_\tAUX\t_\tAspect=Perf\t1\taux\t_\t_",
  "",
  "# sent_id = passive",
  "1\t他\t_\tPRON\t_\t_\t3\tnsubj:pass\t_\t_",
  "2\t被\t_\tAUX\t_\tVoice=Pass\t3\taux:pass\t_\t_",
  "3\t看見\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = copula",
  "1\t他\t_\tPRON\t_\t_\t3\tnsubj\t_\t_",
  "2\t是\t_\tAUX\t_\t_\t3\tcop\t_\t_",
  "3\t學生\t_\tNOUN\t_\t_\t0\troot\t_\t_",
  "",
  "# sent_id = hypothetical-morphology",
  "1\t應該\t_\tAUX\t_\tMood=Nec|VerbType=Mod\t2\taux\t_\t_",
  "2\t走\t_\tVERB\t_\t_\t0\troot\t_\t_",
  "",
].join("\n");

describe("pinned GSD AUX source inventory semantics", () => {
  it("keeps exact AUX relations separate", () => {
    const audit = summarizeModalitySourceEvidence([SOURCE]);

    expect(audit.auxTokenCount).toBe(5);
    expect(audit.relationCounts).toEqual({
      aux: 3,
      "aux:pass": 1,
      cop: 1,
    });
    expect(audit.auxRelationFormCounts).toEqual({
      了: 1,
      會: 1,
      應該: 1,
    });
    expect(audit.auxPassRelationFormCounts).toEqual({ 被: 1 });
  });

  it("records aspect/passive morphology without inferring modality from plain aux", () => {
    const audit = summarizeModalitySourceEvidence([SOURCE]);

    expect(audit.featureCounts).toEqual({
      "Aspect=Perf": 1,
      "Mood=Nec": 1,
      "VerbType=Mod": 1,
      "Voice=Pass": 1,
    });
    expect(audit.diagnosticForms.了).toMatchObject({
      relationCounts: { aux: 1 },
      featureCounts: { "Aspect=Perf": 1 },
    });
    expect(audit.diagnosticForms.被).toMatchObject({
      relationCounts: { "aux:pass": 1 },
      featureCounts: { "Voice=Pass": 1 },
    });
    expect(audit.diagnosticForms.是).toMatchObject({
      relationCounts: { cop: 1 },
      featureCounts: {},
    });
  });

  it("reports explicit Mood/VerbType features only when the source actually has them", () => {
    const audit = summarizeModalitySourceEvidence([SOURCE]);
    expect(audit.moodFeatureCounts).toEqual({ "Mood=Nec": 1 });
    expect(audit.verbTypeFeatureCounts).toEqual({ "VerbType=Mod": 1 });

    const withoutTypedModal = summarizeModalitySourceEvidence([
      SOURCE.replace("Mood=Nec|VerbType=Mod", "_"),
    ]);
    expect(withoutTypedModal.moodFeatureCounts).toEqual({});
    expect(withoutTypedModal.verbTypeFeatureCounts).toEqual({});
  });
});
