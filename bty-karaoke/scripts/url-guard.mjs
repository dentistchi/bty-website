// Guard shared by the QR generator (and its tests). A public guest URL must
// never carry a DJ path or any credential-bearing query parameter.

export function isPublicGuestUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  // Reject any /dj segment (…/dj, …/dj/, …/dj?, …/dj#, or trailing /dj).
  if (/\/dj(\/|\?|#|$)/i.test(url)) return false;
  // Reject credential/token query or fragment params anywhere.
  if (/[?&#](secret|token|dj_secret|credential)=/i.test(url)) return false;
  if (/\b(secret|token)=/i.test(url)) return false;
  return true;
}
