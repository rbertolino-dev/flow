export type GoogleCalendarColor = {
  id: string;
  name: string;
  hex: string;
};

/** Cores oficiais do Google Calendar (colorId 1–11). */
export const GOOGLE_CALENDAR_COLORS: GoogleCalendarColor[] = [
  { id: "1", name: "Lavanda", hex: "#7986CB" },
  { id: "2", name: "Sage", hex: "#33B679" },
  { id: "3", name: "Grape", hex: "#8E24AA" },
  { id: "4", name: "Flamingo", hex: "#E67C73" },
  { id: "5", name: "Banana", hex: "#F6BF26" },
  { id: "6", name: "Tangerine", hex: "#F4511E" },
  { id: "7", name: "Peacock", hex: "#039BE5" },
  { id: "8", name: "Graphite", hex: "#616161" },
  { id: "9", name: "Blueberry", hex: "#3F51B5" },
  { id: "10", name: "Basil", hex: "#0B8043" },
  { id: "11", name: "Tomato", hex: "#D50000" },
];

export const NO_COLOR_ID = "none";

export function getGoogleCalendarColor(colorId: string | null | undefined): GoogleCalendarColor {
  if (!colorId) {
    return { id: NO_COLOR_ID, name: "Sem cor", hex: "#94A3B8" };
  }
  return (
    GOOGLE_CALENDAR_COLORS.find((color) => color.id === colorId) || {
      id: colorId,
      name: `Cor ${colorId}`,
      hex: "#94A3B8",
    }
  );
}

export function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function eventDurationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 60000;
}
