import { test, expect } from "@playwright/test";

/** Helpers espelhados (sem importar src/ que puxa Vite/supabase no Node). */
function isChecklistIncomplete(
  checklist?: Array<{
    response_type?: string | null;
    is_done?: boolean | null;
    answer?: string | null;
  }> | null
): boolean {
  if (!checklist?.length) return false;
  return checklist.some((item) => {
    if (item.response_type === "text") {
      return !(item.answer || "").trim();
    }
    return !item.is_done;
  });
}

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

test.describe("serviceOrderMedia helpers @unit", () => {
  test("isChecklistIncomplete", () => {
    expect(isChecklistIncomplete([])).toBe(false);
    expect(isChecklistIncomplete([{ response_type: "checkpoint", is_done: true }])).toBe(false);
    expect(isChecklistIncomplete([{ response_type: "checkpoint", is_done: false }])).toBe(true);
    expect(isChecklistIncomplete([{ response_type: "text", answer: "ok" }])).toBe(false);
    expect(isChecklistIncomplete([{ response_type: "text", answer: "  " }])).toBe(true);
  });

  test("mapsSearchUrl", () => {
    expect(mapsSearchUrl("Rua A, 10")).toContain("google.com/maps");
    expect(mapsSearchUrl("Rua A, 10")).toContain(encodeURIComponent("Rua A, 10"));
  });
});
