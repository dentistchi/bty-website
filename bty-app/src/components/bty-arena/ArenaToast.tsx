import React from "react";

export type ArenaToastProps = {
  message: string;
};

export function ArenaToast({ message }: ArenaToastProps) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed", bottom: 24, left: "50%",
        transform: "translateX(-50%)", zIndex: 50,
        maxWidth: "min(90vw, 360px)", padding: "12px 20px",
        borderRadius: 12, background: "var(--arena-accent, #6366f1)",
        color: "#fff", fontSize: 14, fontWeight: 500,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      {message}
    </div>
  );
}
