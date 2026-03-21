import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import {
  MAX_LEAD_ATTACHMENT_BYTES,
  uploadLeadAttachmentFile,
  removeLeadAttachmentFromStorage,
} from "@/lib/leadAttachments";
import { broadcastRefreshEvent } from "@/utils/forceRefreshAfterMutation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface LeadAttachmentRow {
  id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  file_size: number;
  created_at: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface LeadAttachmentsSectionProps {
  leadId: string;
  onChanged?: () => void;
}

export function LeadAttachmentsSection({ leadId, onChanged }: LeadAttachmentsSectionProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LeadAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrgId || !leadId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_attachments")
      .select("id, file_name, file_url, storage_path, file_size, created_at")
      .eq("lead_id", leadId)
      .eq("organization_id", activeOrgId)
      .order("created_at", { ascending: false });
    if (error) {
      const msg = error.message || "";
      if (
        msg.includes("does not exist") ||
        (error as { code?: string }).code === "42P01" ||
        (error as { code?: string }).code === "PGRST205"
      ) {
        setRows([]);
        console.warn("lead_attachments não disponível:", error);
      } else {
        toast({
          title: "Erro ao carregar anexos",
          description: error.message,
          variant: "destructive",
        });
        setRows([]);
      }
    } else {
      setRows((data || []) as LeadAttachmentRow[]);
    }
    setLoading(false);
  }, [activeOrgId, leadId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const notifyGlobal = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("data-refresh", {
        detail: { type: "update", entity: "lead", leadId },
      })
    );
    broadcastRefreshEvent("update", "lead");
    onChanged?.();
  }, [leadId, onChanged]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrgId) return;
    if (file.size > MAX_LEAD_ATTACHMENT_BYTES) {
      toast({
        title: "Arquivo grande demais",
        description: `Máximo ${MAX_LEAD_ATTACHMENT_BYTES / 1024 / 1024} MB por arquivo.`,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const { storagePath, publicUrl } = await uploadLeadAttachmentFile(activeOrgId, leadId, file);
      const { error: insErr } = await (supabase as any).from("lead_attachments").insert({
        organization_id: activeOrgId,
        lead_id: leadId,
        storage_path: storagePath,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
      });
      if (insErr) throw insErr;
      toast({ title: "Anexo adicionado", description: file.name });
      await load();
      notifyGlobal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha no envio";
      toast({ title: "Erro ao anexar", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (row: LeadAttachmentRow) => {
    setDeletingId(row.id);
    try {
      const { error: delErr } = await (supabase as any).from("lead_attachments").delete().eq("id", row.id);
      if (delErr) throw delErr;
      await removeLeadAttachmentFromStorage(row.storage_path);
      toast({ title: "Anexo removido", description: row.file_name });
      await load();
      notifyGlobal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao remover";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!activeOrgId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Anexos
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx,.xls,.xlsx,.csv,application/pdf,image/*"
            onChange={handleFile}
            disabled={uploading}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Paperclip className="h-4 w-4 mr-2" />
                Adicionar arquivo
              </>
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Até {MAX_LEAD_ATTACHMENT_BYTES / 1024 / 1024} MB por arquivo (PDF, imagens, planilhas, etc.).
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo neste contato.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/20 text-sm"
            >
              <span className="truncate flex-1 min-w-0 font-medium" title={row.file_name}>
                {row.file_name}
              </span>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatBytes(row.file_size)}
              </span>
              <span className="text-muted-foreground text-xs shrink-0 hidden sm:inline">
                {format(new Date(row.created_at), "dd/MM/yy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <a href={row.file_url} target="_blank" rel="noopener noreferrer" title="Abrir">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                disabled={deletingId === row.id}
                onClick={() => handleDelete(row)}
                title="Remover"
              >
                {deletingId === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
