import BtyAuthGuard from "./_components/BtyAuthGuard";

export default function Page() {
  return (
    <BtyAuthGuard>
      {/* 기존 bty UI */}
      <div>...bty contents...</div>
    </BtyAuthGuard>
  );
}
