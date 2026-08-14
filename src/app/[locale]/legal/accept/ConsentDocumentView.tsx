import type { ConsentDocument, ConsentInline } from "@/domain/legal/consent-document";

/**
 * Renders the ACTIVE consent document (Slice 3.2R-R9A).
 *
 * The prose used to live here as hardcoded JSX beside an unrelated version constant, which is
 * exactly how the text drifted under a frozen version. Now the words come from the one document
 * authority — the same object the fingerprint is computed from — so what the learner reads and
 * what the acceptance records cannot diverge.
 *
 * Presentation only: no wording, no ordering, no emphasis is decided here. Markup and classes are
 * unchanged from the previous hardcoded version, and none of it is hashed.
 */
function Inlines({ runs }: { runs: readonly ConsentInline[] }) {
  return (
    <>
      {runs.map((run, i) =>
        typeof run === "string" ? (
          <span key={i}>{run}</span>
        ) : (
          <strong key={i}>{run.strong}</strong>
        ),
      )}
    </>
  );
}

export function ConsentDocumentView({ doc }: { doc: ConsentDocument }) {
  return (
    <article className="space-y-5 text-[#1E2A38]">
      <h1 className="text-2xl font-semibold">{doc.title}</h1>

      {doc.sections.map((s, si) => (
        <section key={si} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>

          {s.paragraphs.map((p, pi) => (
            <p key={`p${pi}`} className="text-sm leading-relaxed">
              <Inlines runs={p} />
            </p>
          ))}

          {s.bullets.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {s.bullets.map((b, bi) => (
                <li key={bi}>
                  <Inlines runs={b} />
                </li>
              ))}
            </ul>
          ) : null}

          {s.trailing.map((p, ti) => (
            <p key={`t${ti}`} className="text-sm leading-relaxed">
              <Inlines runs={p} />
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
