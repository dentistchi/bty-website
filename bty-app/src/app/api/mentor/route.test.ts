import { describe, it, expect } from "vitest";
import { POST } from "./route";

function request(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/mentor", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mentor", () => {
  it("returns 400 when message is missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when messages is empty and no message field", async () => {
    const res = await POST(request({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with message when lang=ko", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "리더십 피드백 어떻게 주나요?" }],
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
  });

  it("returns 200 with message when lang=en", async () => {
    const res = await POST(
      request({
        message: "How do I handle conflict with a colleague?",
        lang: "en",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
  });

  it("returns 200 with safety_valve and dear_me_url for low self-esteem signal", async () => {
    const res = await POST(
      request({
        messages: [{ role: "user", content: "저는 너무 힘들어요 포기할까봐" }],
        lang: "ko",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.message).toBe("string");
    expect(data.safety_valve).toBe(true);
    expect(data.dear_me_url).toBeDefined();
  });
});
