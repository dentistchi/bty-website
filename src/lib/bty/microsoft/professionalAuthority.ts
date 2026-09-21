/** Pure normalization of the measured Microsoft directory taxonomy. */
const text = (value: string | null | undefined) => (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

const PROVIDER_TITLES = new Set([
  "associate doctor", "general dentist", "dentist", "associate provider", "partner doctor", "orthodontist", "associate clinical director", "clinical director", "chief clinical officer",
]);

export function classifyMicrosoftProfessionalAuthority(jobTitle: string | null, employeeType: string | null) {
  const title = text(jobTitle);
  const workerType = text(employeeType);
  const provider = /^[a-z]{2}\s*-\s*provider$/.test(workerType) || workerType === "partner doctors"
    || (!workerType && (PROVIDER_TITLES.has(title) || /^[a-z]{2}\s+(associate doctor|associate provider|partner doctor)$/.test(title)));
  const manager = workerType === "manager"
    || /(?:^|\s)(manager|director|chief|ceo)(?:\s|$)/.test(title);
  return { isProvider: provider, isManager: manager };
}
