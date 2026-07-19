import { describe, it, expect } from 'vitest';
import {
  consentSatisfied,
  LEGAL_VERSION,
  CONSENT_STORAGE_KEY,
  CONTACT_EMAIL,
  OPERATOR_LONG,
  LEGAL_LINKS,
} from './legal';

describe('consent version logic', () => {
  it('accepts only the exact current version', () => {
    expect(consentSatisfied(LEGAL_VERSION)).toBe(true);
  });
  it('re-prompts when missing (cleared storage / first use)', () => {
    expect(consentSatisfied(null)).toBe(false);
    expect(consentSatisfied(undefined)).toBe(false);
    expect(consentSatisfied('')).toBe(false);
  });
  it('re-prompts on an older version (material change)', () => {
    expect(consentSatisfied('2000-01-01')).toBe(false);
  });
  it('stores a version, not a bare boolean', () => {
    expect(consentSatisfied('true')).toBe(false);
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('legal constants are real + safe', () => {
  it('has a real contact + operator + site-wide (non-event) consent key', () => {
    expect(CONTACT_EMAIL).toContain('@');
    expect(OPERATOR_LONG).toMatch(/Dr\. Chi/);
    expect(CONSENT_STORAGE_KEY).not.toMatch(/\{|\$|event/); // site-wide, not event-scoped
  });
  it('official links are HTTPS to google/youtube; internal are the exact routes', () => {
    expect(LEGAL_LINKS.googlePrivacy).toBe('https://policies.google.com/privacy');
    expect(LEGAL_LINKS.youtubeTerms).toBe('https://www.youtube.com/t/terms');
    expect(LEGAL_LINKS.youtubeApiTerms).toContain('developers.google.com/youtube/terms');
    expect(LEGAL_LINKS.googlePermissions).toContain('myaccount.google.com/permissions');
    expect(LEGAL_LINKS.privacy).toBe('/privacy');
    expect(LEGAL_LINKS.terms).toBe('/terms');
  });
  it('contains no secrets', () => {
    const blob = JSON.stringify({ CONTACT_EMAIL, OPERATOR_LONG, LEGAL_LINKS });
    expect(blob).not.toMatch(/AIza/); // no API key
    expect(blob).not.toMatch(/360772184203/); // no Google project number
  });
});
