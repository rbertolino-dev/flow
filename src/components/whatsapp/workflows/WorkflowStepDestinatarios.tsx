import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { WorkflowListManager } from "./WorkflowListManager";
import { WorkflowGroupSelector } from "./WorkflowGroupSelector";
import { WorkflowList, LeadOption } from "@/types/workflows";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";

interface WorkflowStepDestinatariosProps {
  recipientMode: "list" | "single" | "group";
  workflowListId?: string;
  singleLeadId?: string;
  groupId?: string;
  defaultInstanceId?: string;
  lists: WorkflowList[];
  leadOptions: LeadOption[];
  instances: EvolutionConfig[];
  onRecipientModeChange: (mode: "list" | "single" | "group") => void;
  onWorkflowListChange: (listId: string) => void;
  onSingleLeadChange: (leadId: string) => void;
  onGroupChange: (groupId: string) => void;
  onInstanceChange: (instanceId: string) => void;
  onOpenListManager: () => void;
}

export function WorkflowStepDestinatarios({
  recipientMode,
  workflowListId,
  singleLeadId,
  groupId,
  defaultInstanceId,
  lists,
  leadOptions,
  instances,
  onRecipientModeChange,
  onWorkflowListChange,
  onSingleLeadChange,
  onGroupChange,
  onInstanceChange,
  onOpenListManager,
}: WorkflowStepDestinatariosProps) {
  const selectedList = lists.find((list) => list.id === workflowListId);
  const selectedLead = leadOptions.find((lead) => lead.id === singleLeadId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Destinatários</Label>
        <p className="text-sm text-muted-foreground">
          Escolha quem receberá as mensagens deste workflow
        </p>
      </div>

      {/* Seleção de modo */}
      <div className="space-y-3">
        <Label>Modo de envio</Label>
        <Select value={recipientMode} onValueChange={onRecipientModeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o modo de envio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">
              <div className="flex flex-col">
                <span>Lista de contatos</span>
                <span className="text-xs text-muted-foreground">
                  Enviar para múltiplos contatos de uma lista
                </span>
              </div>
            </SelectItem>
            <SelectItem value="single">
              <div className="flex flex-col">
                <span>Cliente individual</span>
                <span className="text-xs text-muted-foreground">
                  Enviar para um único cliente
                </span>
              </div>
            </SelectItem>
            <SelectItem value="group">
              <div className="flex flex-col">
                <span>Grupo de WhatsApp</span>
                <span className="text-xs text-muted-foreground">
                  Enviar para um grupo do WhatsApp
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Instância padrão */}
      <div className="space-y-3">
        <Label>Instância WhatsApp</Label>
        <Select value={defaultInstanceId} onValueChange={onInstanceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a instância" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                <div className="flex items-center gap-2">
                  <span>{instance.instance_name}</span>
                  <span className={instance.is_connected ? "text-green-500" : "text-red-500"}>
                    {instance.is_connected ? "🟢" : "🔴"}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Configuração específica por modo */}
      {recipientMode === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Lista de contatos</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenListManager}
            >
              Gerenciar listas
            </Button>
          </div>
          <Select value={workflowListId} onValueChange={onWorkflowListChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma lista" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{list.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({list.contacts.length} contatos)
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedList && (
            <p className="text-xs text-muted-foreground">
              {selectedList.contacts.length} destinatário(s) cadastrados nesta lista
            </p>
          )}
        </div>
      )}

      {recipientMode === "single" && (
        <div className="space-y-3">
          <Label>Cliente</Label>
          <Select value={singleLeadId} onValueChange={onSingleLeadChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {leadOptions.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  <div className="flex flex-col">
                    <span>{lead.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {lead.phone} {lead.email && `• ${lead.email}`}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedLead && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{selectedLead.name}</p>
              <p className="text-muted-foreground">{selectedLead.phone}</p>
              {selectedLead.email && (
                <p className="text-muted-foreground">{selectedLead.email}</p>
              )}
            </div>
          )}
        </div>
      )}

      {recipientMode === "group" && (
        <div className="space-y-3">
          <Label>Grupo de WhatsApp</Label>
          <WorkflowGroupSelector
            instanceId={defaultInstanceId}
            instances={instances}
            selectedGroupId={groupId}
            onGroupSelect={onGroupChange}
          />
        </div>
      )}
    </div>
  );
}

