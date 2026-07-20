/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AdminNav from "./AdminNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/admin/arena-membership" }));
vi.mock("@/components/LangSwitch", () => ({ LangSwitch: () => null }));
vi.mock("@/components/auth/LogoutButton", () => ({ default: () => null }));

afterEach(cleanup);

describe("AdminNav", () => {
  it("includes the Member Identity link pointing at /admin/arena-identity", () => {
    render(<AdminNav locale="en" />);
    const link = screen.getByText("Member Identity").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/en/admin/arena-identity");
  });
});
