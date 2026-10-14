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

function mapsCoordsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function fieldCheckinEventLabel(event: string): string {
  switch (event) {
    case "manual":
      return "Confirmação no local";
    case "stage_change":
      return "Ao mudar etapa";
    case "close":
      return "Ao fechar a OS";
    default:
      return event || "Presença";
  }
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

  test("mapsCoordsUrl e rótulos de presença", () => {
    expect(mapsCoordsUrl(-23.55, -46.63)).toContain("-23.55,-46.63");
    expect(fieldCheckinEventLabel("manual")).toBe("Confirmação no local");
    expect(fieldCheckinEventLabel("stage_change")).toBe("Ao mudar etapa");
    expect(fieldCheckinEventLabel("close")).toBe("Ao fechar a OS");
  });
});
