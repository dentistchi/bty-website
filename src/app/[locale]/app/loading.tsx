/**
 * Navy streaming/boot fallback for /[locale]/app (Suspense). The page is force-dynamic;
 * this is shown while it resolves — navy, never white. Calm minimal text, no dashboard,
 * no Orb. Pairs with the server-rendered navy floor in this segment's layout.tsx.
 */
export default function DailyAppLoading() {
  return (
    <div
      data-bty-app-loading="1"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B1F3A",
        color: "rgba(255,255,255,0.5)",
        fontFamily: "-apple-system, system-ui, sans-serif",
        fontSize: 13,
        letterSpacing: "0.02em",
      }}
    >
      Opening BTY…
    </div>
  );
}
