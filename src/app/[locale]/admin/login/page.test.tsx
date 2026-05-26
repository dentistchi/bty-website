/** @vitest-environment jsdom */
/**
 * AdminLoginPage unit tests — Dispatch 2 / Lane 1 (admin email+password login).
 *
 * Lane 1 reuses this existing page (POST /api/auth/login) rather than minting a
 * duplicate at /bty/admin-login. These tests pin:
 * - render: heading + email/password inputs + submit (EN + KO).
 * - success (200, {ok:true}) → window.location.replace to /[locale]/admin/arena-membership
 *   when no ?next= is present (the Lane 1 redirect target), and honors ?next= when set.
 * - 401 → inline error from the parsed body; no navigation.
 * - 5xx / unparseable body → inline fallback (adminLogin.loginFailed); no navigation.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMessages } from "@/lib/i18n";

const mockFetchJson = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: mockLocale }),
}));

vi.mock("@/lib/read-json", () => ({
  fetchJson: (...args: unknown[]) => mockFetchJson(...args),
}));

import AdminLoginPage from "./page";

let mockLocale = "en";
let replaceMock: ReturnType<typeof vi.fn>;

function setLocationSearch(search: string) {
  replaceMock = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search, replace: replaceMock, href: "http://localhost/" },
  });
}

function submitCredentials() {
  const en = getMessages("en").adminLogin;
  fireEvent.change(screen.getByPlaceholderText(en.emailPlaceholder), {
    target: { value: "ywamer2022@gmail.com" },
  });
  fireEvent.change(screen.getByPlaceholderText(en.passwordPlaceholder), {
    target: { value: "secret" },
  });
  const form = screen.getByRole("button").closest("form")!;
  fireEvent.submit(form);
}

beforeEach(() => {
  mockLocale = "en";
  mockFetchJson.mockReset();
  setLocationSearch("");
});

afterEach(() => {
  cleanup();
});

describe("AdminLoginPage — render", () => {
  it("renders EN heading + email/password inputs + submit button", () => {
    const t = getMessages("en").adminLogin;
    render(<AdminLoginPage />);
    expect(screen.getByText(t.heading)).toBeTruthy();
    expect(screen.getByPlaceholderText(t.emailPlaceholder)).toBeTruthy();
    expect(screen.getByPlaceholderText(t.passwordPlaceholder)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.loginSubmitAriaIdle })).toBeTruthy();
  });

  it("renders KO copy when locale=ko", () => {
    mockLocale = "ko";
    const t = getMessages("ko").adminLogin;
    render(<AdminLoginPage />);
    expect(screen.getByText(t.heading)).toBeTruthy();
    expect(screen.getByPlaceholderText(t.emailPlaceholder)).toBeTruthy();
  });
});

describe("AdminLoginPage — submit success", () => {
  it("on 200 {ok:true} with no ?next, redirects to /[locale]/admin/arena-membership", async () => {
    mockFetchJson.mockResolvedValue({ ok: true, json: { ok: true }, status: 200 });
    render(<AdminLoginPage />);
    submitCredentials();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/en/admin/arena-membership");
    });
    expect(mockFetchJson).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("honors ?next= over the default arena-membership target", async () => {
    setLocationSearch("?next=/en/admin/users");
    mockFetchJson.mockResolvedValue({ ok: true, json: { ok: true }, status: 200 });
    render(<AdminLoginPage />);
    submitCredentials();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/en/admin/users");
    });
  });
});

describe("AdminLoginPage — submit failure", () => {
  it("on 401 shows the parsed error and does not navigate", async () => {
    mockFetchJson.mockResolvedValue({
      ok: false,
      raw: JSON.stringify({ ok: false, error: "Invalid login credentials" }),
      status: 401,
    });
    render(<AdminLoginPage />);
    submitCredentials();
    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeTruthy();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("on 5xx / empty body falls back to adminLogin.loginFailed and does not navigate", async () => {
    const t = getMessages("en").adminLogin;
    // fetchJson returns `raw: raw || undefined`, so an empty 500 body arrives as undefined.
    mockFetchJson.mockResolvedValue({ ok: false, raw: undefined, status: 500 });
    render(<AdminLoginPage />);
    submitCredentials();
    await waitFor(() => {
      expect(screen.getByText(t.loginFailed)).toBeTruthy();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
