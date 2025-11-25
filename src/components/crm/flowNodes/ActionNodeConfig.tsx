import { ActionConfig } from "@/types/automationFlow";
import { AutomationActionType } from "@/types/followUp";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTags } from "@/hooks/useTags";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";

interface ActionNodeConfigProps {
  config: ActionConfig;
  onConfigChange: (config: ActionConfig) => void;
}

const actionTypeLabels: Record<AutomationActionType, string> = {
  send_whatsapp: "Enviar WhatsApp",
  send_whatsapp_template: "Enviar Template WhatsApp",
  add_tag: "Adicionar Tag",
  remove_tag: "Remover Tag",
  move_stage: "Mover para Etapa",
  add_note: "Adicionar Nota",
  add_to_call_queue: "Adicionar à Fila",
  remove_from_call_queue: "Remover da Fila",
  update_field: "Atualizar Campo",
  update_value: "Atualizar Valor",
  apply_template: "Aplicar Template",
  wait_delay: "Aguardar Tempo",
  create_reminder: "Criar Lembrete",
};

export function ActionNodeConfig({ config, onConfigChange }: ActionNodeConfigProps) {
  const { tags } = useTags();
  const { stages } = usePipelineStages();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const { templates: messageTemplates } = useMessageTemplates();
  const { templates: followUpTemplates } = useFollowUpTemplates();

  const handleActionTypeChange = (actionType: AutomationActionType) => {
    onConfigChange({ actionType, ...getDefaultConfig(actionType) });
  };

  const getDefaultConfig = (actionType: AutomationActionType): Record<string, any> => {
    switch (actionType) {
      case 'add_to_call_queue':
        return { priority: 'medium' };
      default:
        return {};
    }
  };

  const updateConfig = (updates: Record<string, any>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Ação *</Label>
        <Select
          value={config.actionType}
          onValueChange={(value) => handleActionTypeChange(value as AutomationActionType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a ação" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(actionTypeLabels).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Configurações específicas por tipo de ação */}
      {(config.actionType === 'send_whatsapp' || config.actionType === 'send_whatsapp_template') && (
        <>
          <div className="space-y-2">
            <Label>Instância WhatsApp *</Label>
            <Select
              value={config.instance_id || ""}
              onValueChange={(value) => updateConfig({ instance_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {evolutionConfigs?.filter(c => c.is_connected).map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.actionType === 'send_whatsapp' ? (
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={config.message || ""}
                onChange={(e) => updateConfig({ message: e.target.value })}
                placeholder="Digite a mensagem... Use {{nome}}, {{telefone}}, {{email}} para variáveis"
                rows={4}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Template de Mensagem *</Label>
              <Select
                value={config.template_id || ""}
                onValueChange={(value) => updateConfig({ template_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {messageTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {(config.actionType === 'add_tag' || config.actionType === 'remove_tag') && (
        <div className="space-y-2">
          <Label>Tag *</Label>
          <Select
            value={config.tag_id || ""}
            onValueChange={(value) => updateConfig({ tag_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tag" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.actionType === 'move_stage' && (
        <div className="space-y-2">
          <Label>Etapa de Destino *</Label>
          <Select
            value={config.stage_id || ""}
            onValueChange={(value) => updateConfig({ stage_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.actionType === 'add_note' && (
        <div className="space-y-2">
          <Label>Conteúdo da Nota *</Label>
          <Textarea
            value={config.content || ""}
            onChange={(e) => updateConfig({ content: e.target.value })}
            placeholder="Digite o conteúdo da nota..."
            rows={3}
          />
        </div>
      )}

      {config.actionType === 'add_to_call_queue' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={config.priority || "medium"}
              onValueChange={(value) => updateConfig({ priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={config.notes || ""}
              onChange={(e) => updateConfig({ notes: e.target.value })}
              placeholder="Notas para a ligação..."
              rows={2}
            />
          </div>
        </div>
      )}

      {config.actionType === 'update_value' && (
        <div className="space-y-2">
          <Label>Novo Valor (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            value={config.value || ""}
            onChange={(e) => updateConfig({ value: e.target.value })}
            placeholder="0.00"
          />
        </div>
      )}

      {config.actionType === 'update_field' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Campo</Label>
            <Select
              value={config.field || ""}
              onValueChange={(value) => updateConfig({ field: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned_to">Responsável</SelectItem>
                <SelectItem value="value">Valor</SelectItem>
                <SelectItem value="source">Origem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor *</Label>
            <Input
              value={config.value || ""}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="Digite o novo valor..."
            />
          </div>
        </div>
      )}

      {config.actionType === 'apply_template' && (
        <div className="space-y-2">
          <Label>Template de Follow-up *</Label>
          <Select
            value={config.template_id || ""}
            onValueChange={(value) => updateConfig({ template_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o template" />
            </SelectTrigger>
            <SelectContent>
              {followUpTemplates.filter(t => t.isActive).map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.actionType === 'create_reminder' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título do Lembrete *</Label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateConfig({ title: e.target.value })}
              placeholder="Ex.: Ligar para cliente amanhã"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={config.description || ""}
              onChange={(e) => updateConfig({ description: e.target.value })}
              placeholder="Detalhes do lembrete..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Data/Hora do Lembrete</Label>
            <Input
              type="datetime-local"
              value={config.reminder_date || ""}
              onChange={(e) => updateConfig({ reminder_date: e.target.value })}
            />
          </div>
        </div>
      )}

      {config.actionType === 'remove_from_call_queue' && (
        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          O lead será removido da fila de ligações quando esta ação for executada.
        </div>
      )}
    </div>
  );
}

