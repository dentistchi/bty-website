/** @vitest-environment jsdom */
/**
 * AuthGate — OAuth-only inline CTA (Lane 3, D-1 2026-05-29).
 * The anonymous branch must render a single "Continue with Google" CTA linking
 * to `/[locale]/bty/login?next=/[locale]/bty` — NOT the legacy email/password
 * form. Authenticated → children; loading → LoadingFallback.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/bty-arena", () => ({
  LoadingFallback: ({ message }: { message?: string }) => (
    <div data-testid="loading-fallback">{message}</div>
  ),
}));

import { AuthGate } from "./AuthGate";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthGate — OAuth-only inline CTA", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/en");
  });

  it("anonymous + !loading: renders 'Continue with Google' CTA → /en/bty/login?next=/en/bty", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <AuthGate>
        <div>protected-content</div>
      </AuthGate>
    );
    const cta = screen.getByText("Continue with Google");
    expect(cta.getAttribute("href")).toBe("/en/bty/login?next=/en/bty");
    // children must NOT render for anonymous users
    expect(screen.queryByText("protected-content")).toBeNull();
  });

  it("regression guard: no email/password form or register toggle in DOM", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(
      <AuthGate>
        <div>protected-content</div>
      </AuthGate>
    );
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByText("회원가입")).toBeNull();
  });

  it("authenticated: renders children", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false });
    render(
      <AuthGate>
        <div>protected-content</div>
      </AuthGate>
    );
    expect(screen.getByText("protected-content")).toBeTruthy();
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });

  it("loading: renders LoadingFallback, no CTA", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <AuthGate loadingMessage="please wait">
        <div>protected-content</div>
      </AuthGate>
    );
    expect(screen.getByTestId("loading-fallback")).toBeTruthy();
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });

  it("ko locale: CTA points to /ko paths", () => {
    mockUsePathname.mockReturnValue("/ko");
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <AuthGate>
        <div>protected-content</div>
      </AuthGate>
    );
    const cta = screen.getByText("Google로 계속하기");
    expect(cta.getAttribute("href")).toBe("/ko/bty/login?next=/ko/bty");
  });
});
