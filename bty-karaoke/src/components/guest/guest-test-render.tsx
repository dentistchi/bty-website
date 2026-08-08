// BUILD 26G — the render helper Guest component tests use.
//
// Every pre-26G Guest test asserts the SHIPPED KOREAN copy, and that is exactly what they
// should keep asserting: it is how we prove Korean did not regress. So this mounts the
// component inside a Guest locale provider pinned to a language, and — because the provider
// re-resolves from the browser after mount — ALSO writes the stored choice, which is the
// highest-priority input. Without that, jsdom's `navigator.languages` (`en-US`) would win
// and the Korean assertions would fail for a reason that has nothing to do with the test.
//
// `renderGuest(ui, 'en')` renders the same component in English, which is how the bilingual
// contracts assert both languages against ONE component.

import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import {
  GUEST_LOCALE_STORAGE_KEY,
  type GuestLocale,
} from '@/domain/guest-locale';
import { GuestLocaleProvider } from './GuestLocaleProvider';

export function renderGuest(ui: ReactElement, locale: GuestLocale = 'ko') {
  try {
    window.localStorage.setItem(GUEST_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage disabled in this environment — `initialLocale` still pins the first paint.
  }
  return render(<GuestLocaleProvider initialLocale={locale}>{ui}</GuestLocaleProvider>);
}
