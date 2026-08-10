import type {
  CoordinationObservation,
  ImmediateHandObservation,
  ImmediateTokenObservation,
  SameHandRevisitObservation,
  ToneCommitObservation,
} from "./types.js";

export function coordinationTimingSample(
  observation: CoordinationObservation,
): number | null {
  return observation.clean ? observation.timingMs : null;
}

export function immediateTokenTimingSample(
  observation: ImmediateTokenObservation,
): number | null {
  return observation.clean && observation.boundary === "within-syllable"
    ? observation.timingMs
    : null;
}

export function immediateHandTimingSample(
  observation: ImmediateHandObservation,
): number | null {
  return observation.clean && observation.boundary === "within-syllable"
    ? observation.timingMs
    : null;
}

export function sameHandRevisitTimingSample(
  observation: SameHandRevisitObservation,
): number | null {
  return observation.clean && observation.boundary === "within-syllable"
    ? observation.timingMs
    : null;
}

export function toneCommitTimingSample(
  observation: ToneCommitObservation,
): number | null {
  return observation.clean ? observation.timingMs : null;
}
