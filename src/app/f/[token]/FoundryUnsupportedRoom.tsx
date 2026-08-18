/**
 * The honest surface for a room whose stored `content_type` is one this build does not know
 * (Slice R4-R2G).
 *
 * WHY IT EXISTS AT ALL. Before this slice the learner's front door ended in an unguarded
 * `return <FoundryJoinClient/>`, so an unrecognised discriminator produced the VIDEO room: a
 * confident, complete, entirely wrong training. This is what fail-closed looks like on a screen —
 * a learner who is told their link cannot be opened here goes and asks, which is recoverable. A
 * learner shown the wrong training does not know to ask.
 *
 * No enum name, no error code, no version number: the learner did nothing wrong and has no use
 * for any of that. Server component — nothing to hydrate for a page with no interaction.
 */
export default function FoundryUnsupportedRoom() {
  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">This training can&rsquo;t be opened here</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Ask whoever shared this link to open it for you.
        </p>
      </div>
    </main>
  );
}
