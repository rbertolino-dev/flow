import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_COLOR_STATUS_MAPS,
  type CalendarColorStatusMap,
  type CalendarEventStatus,
} from "@/lib/calendarEventStatus";

export function useCalendarColorStatusMaps() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["calendar-color-status-maps", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [] as CalendarColorStatusMap[];
      const { data, error } = await supabase
        .from("calendar_color_status_maps" as never)
        .select("color_id, status, label")
        .eq("organization_id", activeOrgId)
        .order("color_id");
      if (error) throw error;
      const rows = (data || []) as CalendarColorStatusMap[];
      return rows.length > 0 ? rows : DEFAULT_COLOR_STATUS_MAPS;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (maps: CalendarColorStatusMap[]) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { error: deleteError } = await supabase
        .from("calendar_color_status_maps" as never)
        .delete()
        .eq("organization_id", activeOrgId);
      if (deleteError) throw deleteError;

      const payload = maps
        .filter((item) => item.color_id && item.status && item.label.trim())
        .map((item) => ({
          organization_id: activeOrgId,
          color_id: item.color_id,
          status: item.status as CalendarEventStatus,
          label: item.label.trim(),
          updated_at: new Date().toISOString(),
        }));

      if (payload.length === 0) return;

      const { error: insertError } = await supabase
        .from("calendar_color_status_maps" as never)
        .insert(payload as never);
      if (insertError) throw insertError;

      // Reaplica status nos eventos já espelhados conforme o novo mapa.
      for (const item of payload) {
        const isDone = item.status === "completed" || item.status === "closing";
        let updateQuery = supabase
          .from("calendar_events")
          .update({
            status: item.status,
            completed_at: isDone ? new Date().toISOString() : null,
          } as never)
          .eq("organization_id", activeOrgId);

        updateQuery =
          item.color_id === "none"
            ? updateQuery.is("color_id", null)
            : updateQuery.eq("color_id", item.color_id);

        const { error: updateError } = await updateQuery;
        if (updateError) throw updateError;
      }

      const mappedColorIds = new Set(
        payload.filter((item) => item.color_id !== "none").map((item) => item.color_id),
      );
      const mapsNone = payload.some((item) => item.color_id === "none");

      const { data: events, error: listError } = await supabase
        .from("calendar_events")
        .select("id, color_id")
        .eq("organization_id", activeOrgId);
      if (listError) throw listError;

      const resetIds = (events || [])
        .filter((event) => {
          if (!event.color_id) return !mapsNone;
          return !mappedColorIds.has(event.color_id);
        })
        .map((event) => event.id);

      for (let index = 0; index < resetIds.length; index += 100) {
        const chunk = resetIds.slice(index, index + 100);
        if (!chunk.length) continue;
        const { error: resetError } = await supabase
          .from("calendar_events")
          .update({ status: "scheduled", completed_at: null } as never)
          .in("id", chunk);
        if (resetError) throw resetError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-color-status-maps"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-report"] });
      toast({
        title: "Mapa de cores salvo",
        description: "Cada cor agora representa o status configurado nos agendamentos.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o mapa de cores.",
        variant: "destructive",
      });
    },
  });

  return {
    maps: query.data || DEFAULT_COLOR_STATUS_MAPS,
    isLoading: query.isLoading,
    saveMaps: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    refetch: query.refetch,
  };
}
