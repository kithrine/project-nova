/**
 * The ADR-015 intake eligibility rubric (Story 2.8) — the ONLY criteria an
 * eligibility determination may weigh. Offense history is never part of
 * eligibility (a criminal record is the program's qualifying condition);
 * offense-related concerns belong to the background stage (2.10) under the
 * individualized-assessment rules. Pure data, client-safe.
 */
export const ELIGIBILITY_RUBRIC: { key: string; label: string }[] = [
  { key: "age", label: "18 years of age or older" },
  {
    key: "justiceInvolved",
    label:
      "Justice-involved: released within the program window (default 7 years) or currently under community supervision",
  },
  { key: "workAuthorization", label: "Legally authorized to work in the United States" },
  { key: "serviceArea", label: "Resides in, or can reliably reach, the service area" },
  {
    key: "noBlock",
    label: "Not blocked by a permanent disqualification (ADR-016)",
  },
];
