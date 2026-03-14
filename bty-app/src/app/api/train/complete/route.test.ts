/**
 * POST /api/train/complete — 400 invalid day, 200 ok.
 */
import { describe, it, expect } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/train/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/train/complete", () => {
  it("returns 400 when day is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid day");
  });

  it("returns 400 when day is not a number", async () => {
    const res = await POST(makeRequest({ day: "abc" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid day");
  });

  it("returns 400 when day is out of range (0, 29)", async () => {
    const res0 = await POST(makeRequest({ day: 0 }));
    expect(res0.status).toBe(400);
    const data0 = await res0.json();
    expect(data0.error).toBe("invalid day");

    const res29 = await POST(makeRequest({ day: 29 }));
    expect(res29.status).toBe(400);
    const data29 = await res29.json();
    expect(data29.error).toBe("invalid day");
  });

  it("returns 200 with ok true when day is valid (1–28)", async () => {
    const res = await POST(makeRequest({ day: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 200 with content-type application/json on success", async () => {
    const res = await POST(makeRequest({ day: 5 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
