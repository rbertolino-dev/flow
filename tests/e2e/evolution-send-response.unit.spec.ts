import { test, expect } from "@playwright/test";

// Espelha a lógica de supabase/functions/_shared/evolution-send-response.ts
function validateEvolutionSendResponse(httpStatus: number, responseText: string) {
  const parseBody = (text: string) => {
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text.slice(0, 500) };
    }
  };
  const messageFromData = (data: unknown) => {
    if (!data || typeof data !== "object") return undefined;
    const o = data as Record<string, unknown>;
    const response = o.response as Record<string, unknown> | undefined;
    return response?.message ?? o.message ?? o.error;
  };
  const data = parseBody(responseText);
  const lower = responseText.toLowerCase();
  if (httpStatus === 428 || lower.includes("connection closed")) {
    return { ok: false, connectionClosed: true };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ok: false };
  }
  const o = data as Record<string, unknown> | null;
  const key = o?.key as Record<string, unknown> | undefined;
  if (typeof key?.id === "string" && key.id) return { ok: true, messageId: key.id };
  const msg = messageFromData(data);
  if (typeof msg === "string" && msg.trim()) return { ok: false };
  if (!responseText.trim()) return { ok: false };
  return { ok: false };
}

test.describe("@unit evolution send response validation", () => {
  test("aceita HTTP 200 com key.id", () => {
    const body = JSON.stringify({
      key: { id: "ABC123", remoteJid: "5511999999999@s.whatsapp.net" },
      status: "PENDING",
    });
    expect(validateEvolutionSendResponse(200, body).ok).toBe(true);
  });

  test("rejeita Connection Closed no body mesmo com HTTP 200", () => {
    const body = JSON.stringify({ response: { message: "Connection Closed" } });
    const r = validateEvolutionSendResponse(200, body);
    expect(r.ok).toBe(false);
    expect(r.connectionClosed).toBe(true);
  });

  test("rejeita HTTP 200 sem key.id nem confirmação", () => {
    const body = JSON.stringify({ foo: "bar" });
    expect(validateEvolutionSendResponse(200, body).ok).toBe(false);
  });

  test("rejeita exists:false", () => {
    const body = JSON.stringify({
      response: { message: [{ exists: false, jid: "5511888888888@s.whatsapp.net" }] },
    });
    expect(validateEvolutionSendResponse(400, body).ok).toBe(false);
  });
});
