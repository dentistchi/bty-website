import { describe, expect, it } from "vitest";
import { classifyMicrosoftProfessionalAuthority } from "./professionalAuthority";
describe("Microsoft professional authority", () => {
  it.each(["WA - Provider", "AK - Provider", "Partner Doctors"])("recognizes measured provider type %s", employeeType => expect(classifyMicrosoftProfessionalAuthority(null, employeeType).isProvider).toBe(true));
  it.each(["General Dentist", "Associate Doctor", "Associate Provider", "Partner Doctor", "Orthodontist"])("recognizes anchored provider title %s", jobTitle => expect(classifyMicrosoftProfessionalAuthority(jobTitle, null).isProvider).toBe(true));
  it.each(["Dental Assistant", "Clinic Assistant", "Dental Hygienist", "Treatment Coordinator", "Clinic Lead", "Senior Lead"])("denies non-provider %s", jobTitle => expect(classifyMicrosoftProfessionalAuthority(jobTitle, null).isProvider).toBe(false));
  it.each(["Office Manager", "Operations Manager", "Associate Manager", "Regional Manager", "General Manager", "Director of Operations"])("recognizes manager %s", jobTitle => expect(classifyMicrosoftProfessionalAuthority(jobTitle, null).isManager).toBe(true));
});
