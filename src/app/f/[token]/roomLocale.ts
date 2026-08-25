import { isSavedLocale, type SavedLocale } from "@/lib/localePreference";

/**
 * WHICH LANGUAGE A LEARNER ROOM SPEAKS (Slice R4-R5C16A).
 *
 * MEASURED ON A REAL LEARNER. The app shell was in Korean, every string the room needed already
 * had a Korean translation — 49 of 49 in the guidance room, plus the Journey headings — and the
 * room still rendered English. All three room clients each carried their own copy of:
 *
 *     if (navigator.language?.startsWith("ko")) return "ko"; return "en";
 *
 * So the DEVICE decided, and the device is an iPhone whose system language is English. A person
 * who had chosen Korean inside BTY was shown English by the one surface that matters most, and
 * nothing about it looked like a bug: the sentences were Korean, only the chrome was not.
 *
 * `NEXT_LOCALE` was already the answer and already written by `/api/locale/set` — `middleware.ts`
 * has said so for slices: "the single entry resolver — do not add a parallel locale system", and
 * it already prefers the cookie over `Accept-Language`. The room simply never asked. This is that
 * question, asked once, for all three families.
 *
 * PRECEDENCE, and why `navigator` survives at all: a chosen preference always wins, because an OS
 * language is a guess about a person and a preference is that person's answer. Where no preference
 * exists there is nothing to override, and the device's language is the best guess available —
 * which is exactly how an open-link learner who has never opened the app gets Korean.
 */
export type RoomLocale = SavedLocale;

/**
 * The room's language, resolved once.
 *
 * @param saved   the BTY preference, read server-side from `NEXT_LOCALE`. `null` when unset.
 * @param deviceLanguage `navigator.language`, or null/undefined where there is no navigator.
 */
export function resolveRoomLocale(saved: unknown, deviceLanguage?: string | null): RoomLocale {
  if (isSavedLocale(saved)) return saved;
  if (typeof deviceLanguage === "string" && deviceLanguage.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}

/**
 * The client half: the server's answer if it had one, otherwise this device's language.
 *
 * NO FLASH when a preference exists — the value is known before the first render, so the entry
 * screen, the room and the terminal are all Korean from the first paint. Without a preference the
 * server cannot know the device language at all, so that case still resolves on mount; it renders
 * English for one frame, which is the same behaviour it has always had and only for people who
 * have never chosen a language.
 */
export function resolveRoomLocaleOnClient(saved: unknown): RoomLocale {
  return resolveRoomLocale(saved, typeof navigator !== "undefined" ? navigator.language : null);
}
