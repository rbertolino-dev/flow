import { useEffect, useState } from "react";
import { Palette, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendarColorStatusMaps } from "@/hooks/useCalendarColorStatusMaps";
import {
  CALENDAR_EVENT_STATUSES,
  DEFAULT_COLOR_STATUS_MAPS,
  type CalendarColorStatusMap,
  type CalendarEventStatus,
} from "@/lib/calendarEventStatus";
import { GOOGLE_CALENDAR_COLORS, NO_COLOR_ID } from "@/lib/googleCalendarColors";

export function CalendarColorStatusSettings() {
  const { maps, isLoading, saveMaps, isSaving } = useCalendarColorStatusMaps();
  const [draft, setDraft] = useState<CalendarColorStatusMap[]>([]);

  useEffect(() => {
    setDraft(maps.length ? maps : DEFAULT_COLOR_STATUS_MAPS);
  }, [maps]);

  const colorOptions = [
    { id: NO_COLOR_ID, name: "Sem cor", hex: "#94A3B8" },
    ...GOOGLE_CALENDAR_COLORS,
  ];

  const updateRow = (index: number, patch: Partial<CalendarColorStatusMap>) => {
    setDraft((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => {
    const used = new Set(draft.map((row) => row.color_id));
    const nextColor = colorOptions.find((color) => !used.has(color.id));
    if (!nextColor) return;
    setDraft((current) => [
      ...current,
      {
        color_id: nextColor.id,
        status: "scheduled",
        label: "Agendada",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setDraft((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleSave = async () => {
    await saveMaps(draft);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mapa de cores...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 md:px-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <Palette className="h-5 w-5 text-sky-600" />
          Configurar cores e status
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Este é o lugar para definir o significado de cada cor do Google Calendar/Meet.
          Exemplo: verde (Sage) = reunião realizada; verde escuro (Basil) = fechamento.
          Depois de salvar, os agendamentos acompanham o status pela cor.
        </p>
      </div>

      {draft.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
          {draft.map((row) => {
            const color = colorOptions.find((item) => item.id === row.color_id);
            return (
              <div
                key={`preview-${row.color_id}-${row.status}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span
                  className="h-3 w-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: color?.hex || "#94A3B8" }}
                />
                <span className="text-slate-500">{color?.name || "Cor"}</span>
                <span className="text-slate-300">→</span>
                <span className="font-medium text-slate-800">{row.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa de cores</CardTitle>
          <CardDescription>
            Escolha a cor, o status interno e o nome que aparece nos relatórios e na agenda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {draft.map((row, index) => {
              const color = colorOptions.find((item) => item.id === row.color_id);
              return (
                <div
                  key={`${row.color_id}-${index}`}
                  className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1.2fr_1.2fr_1.4fr_auto]"
                >
                  <div className="space-y-1.5">
                    <Label>Cor do Google</Label>
                    <Select
                      value={row.color_id}
                      onValueChange={(value) => updateRow(index, { color_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full border border-slate-300"
                                style={{ backgroundColor: item.hex }}
                              />
                              {item.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={row.status}
                      onValueChange={(value) => {
                        const status = value as CalendarEventStatus;
                        const defaultLabel =
                          CALENDAR_EVENT_STATUSES.find((item) => item.value === status)?.label ||
                          row.label;
                        updateRow(index, { status, label: defaultLabel });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_EVENT_STATUSES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Nome exibido</Label>
                    <Input
                      value={row.label}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                      placeholder="Ex.: Reunião realizada"
                    />
                    {color && (
                      <p className="text-xs text-slate-500">
                        {color.name} → {row.label}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeRow(index)}
                      aria-label="Remover mapeamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar cor
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
