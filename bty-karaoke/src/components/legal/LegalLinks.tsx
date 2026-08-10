import { LEGAL_LINKS, CONTACT_EMAIL } from '@/lib/legal';

/**
 * Persistent, always-visible legal links (no JavaScript required). Rendered in the
 * public footer of the landing, guest room, request screen, and the legal pages so
 * the Privacy Policy and Terms are reachable from every public surface.
 */
export default function LegalLinks({ showContact = false }: { showContact?: boolean }) {
  return (
    <footer className="legal-links" aria-label="법적 고지 · Legal">
      <a href={LEGAL_LINKS.privacy}>개인정보처리방침</a>
      <span aria-hidden>·</span>
      <a href={LEGAL_LINKS.terms}>이용약관</a>
      <span aria-hidden>·</span>
      {/* BUILD 26J-R2: support must be reachable from every public surface, not only from
          the page a user already found. App Review follows footer links. */}
      <a href={LEGAL_LINKS.support}>고객지원</a>
      {showContact && (
        <>
          <span aria-hidden>·</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>문의</a>
        </>
      )}
    </footer>
  );
}
