import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
  validRuntimeOccurrenceCapabilities,
} from "../../src/syntax/runtime-occurrence-capabilities.js";

describe("locative runtime sidecar integration", () => {
  it("keeps the reviewed capability in the runtime capability registry", () => {
    expect(validRuntimeOccurrenceCapabilities([
      VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
    ])).toBe(true);
  });

  it("packages exactly the reviewed identity-safe 在/VERB profile", () => {
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(1);
    expect(occurrenceBacked[0]?.entryId).toBe("word:在:ㄗㄞ4");
    expect(occurrenceBacked[0]?.upos).toBe("VERB");
    expect(occurrenceBacked[0]?.functions).toContain("predicate");
    expect(textByEntryId.get(occurrenceBacked[0]?.entryId ?? "")).toBe("在");
  });

  it("makes the reviewed capability authoritative only for the locative predicate head", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.includes(
          VERBAL_LOCATIVE_ROOT_SUBJECT_OBJECT_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );
    expect(consumers).toEqual(["clause.locative:predicate"]);
  });
});
