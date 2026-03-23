import type { CSSProperties, ReactNode } from "react";

/**
 * `/bty-arena` 세션 UI용 에러 상태 셸(render-only).
 * 문구는 `getMessages(locale).arenaRun` 의 `arenaRunError*` 키를 전달한다.
 */
export type ArenaRunErrorShellProps = {
  /** `arenaRun.arenaRunErrorMainRegionAria` */
  mainAriaLabel: string;
  /** `arenaRun.arenaRunErrorTitle` */
  title: string;
  /** `arenaRun.arenaRunErrorDescription` */
  description: string;
  /** `arenaRun.arenaRunErrorHint` */
  hint?: string;
  /** 데코용 아이콘 문자(기본 ⚠️) — `aria-hidden` */
  icon?: string;
  /** 추가 액션(재시도 버튼 등) */
  children?: ReactNode;
  "data-testid"?: string;
  style?: CSSProperties;
};

export function ArenaRunErrorShell({
  mainAriaLabel,
  title,
  description,
  hint,
  icon = "⚠️",
  children,
  "data-testid": dataTestId = "arena-run-error-shell",
  style,
}: ArenaRunErrorShellProps) {
  return (
    <main
      data-testid={dataTestId}
      aria-label={mainAriaLabel}
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: 24,
        ...style,
      }}
    >
      <div
        style={{
          marginTop: 0,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "var(--arena-card)",
          padding: "32px 20px",
        }}
      >
        <div role="alert" aria-live="assertive" aria-atomic="true">
          {icon ? (
            <span
              style={{
                fontSize: 40,
                lineHeight: 1,
                display: "block",
                marginBottom: 16,
                opacity: 0.85,
              }}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--arena-text)",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: "var(--arena-text)",
              opacity: 0.9,
            }}
          >
            {description}
          </p>
          {hint ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                color: "var(--arena-text-soft)",
                opacity: 0.9,
              }}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
      </div>
    </main>
  );
}
