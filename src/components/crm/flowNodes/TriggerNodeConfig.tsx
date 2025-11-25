import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { TriggerConfig, TriggerType } from "@/types/automationFlow";

interface TriggerNodeConfigProps {
  config: TriggerConfig;
  onConfigChange: (config: TriggerConfig) => void;
}

export function TriggerNodeConfig({ config, onConfigChange }: TriggerNodeConfigProps) {
  const { tags } = useTags();
  const { stages } = usePipelineStages();

  const handleTypeChange = (type: TriggerType) => {
    const newConfig: TriggerConfig = {
      triggerType: type,
    };
    onConfigChange(newConfig);
  };

  const updateConfig = (updates: Partial<TriggerConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Gatilho *</Label>
        <Select value={config.triggerType} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead_created">Lead Criado</SelectItem>
            <SelectItem value="tag_added">Tag Adicionada</SelectItem>
            <SelectItem value="tag_removed">Tag Removida</SelectItem>
            <SelectItem value="stage_changed">Estágio Mudou</SelectItem>
            <SelectItem value="field_changed">Campo Mudou</SelectItem>
            <SelectItem value="date_trigger">Data Específica</SelectItem>
            <SelectItem value="relative_date">Data Relativa</SelectItem>
            <SelectItem value="google_calendar_event">Evento do Google Agenda</SelectItem>
            <SelectItem value="lead_return_date">Data de Retorno do Lead</SelectItem>
            <SelectItem value="last_message_sent">Última Mensagem Enviada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Configurações específicas por tipo */}
      {config.triggerType === 'tag_added' || config.triggerType === 'tag_removed' ? (
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
      ) : null}

      {config.triggerType === 'stage_changed' ? (
        <div className="space-y-2">
          <Label>Estágio *</Label>
          <Select
            value={config.stage_id || ""}
            onValueChange={(value) => updateConfig({ stage_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o estágio" />
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
      ) : null}

      {config.triggerType === 'field_changed' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Campo *</Label>
            <Select
              value={config.field || ""}
              onValueChange={(value) => updateConfig({ field: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">Valor</SelectItem>
                <SelectItem value="source">Origem</SelectItem>
                <SelectItem value="assigned_to">Responsável</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor (opcional)</Label>
            <Input
              value={config.value || ""}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="Valor específico (deixe vazio para qualquer mudança)"
            />
          </div>
        </div>
      ) : null}

      {config.triggerType === 'date_trigger' ? (
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input
            type="datetime-local"
            value={config.date ? new Date(config.date).toISOString().slice(0, 16) : ""}
            onChange={(e) => updateConfig({ date: new Date(e.target.value).toISOString() })}
          />
        </div>
      ) : null}

      {config.triggerType === 'relative_date' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Campo de Data *</Label>
            <Select
              value={config.field || ""}
              onValueChange={(value) => updateConfig({ field: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data de Criação</SelectItem>
                <SelectItem value="last_contact">Último Contato</SelectItem>
                <SelectItem value="return_date">Data de Retorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dias Antes *</Label>
            <Input
              type="number"
              min="0"
              value={config.days_before || ""}
              onChange={(e) => updateConfig({ days_before: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7 (7 dias antes)"
            />
          </div>
        </div>
      ) : null}

      {config.triggerType === 'lead_created' ? (
        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          Este gatilho será acionado sempre que um novo lead for criado no sistema.
        </div>
      ) : null}

      {config.triggerType === 'google_calendar_event' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Dias Antes do Evento *</Label>
            <Input
              type="number"
              min="0"
              value={config.days_before || ""}
              onChange={(e) => updateConfig({ days_before: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 1 (1 dia antes do evento)"
            />
          </div>
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            Este gatilho será acionado X dias antes de um evento do Google Agenda associado ao lead.
          </div>
        </div>
      ) : null}

      {config.triggerType === 'lead_return_date' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Dias Antes da Data de Retorno *</Label>
            <Input
              type="number"
              min="0"
              value={config.days_before || ""}
              onChange={(e) => updateConfig({ days_before: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 1 (1 dia antes da data de retorno)"
            />
          </div>
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            Este gatilho será acionado X dias antes da data de retorno definida no card do lead.
          </div>
        </div>
      ) : null}

      {config.triggerType === 'last_message_sent' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Dias Após Última Mensagem *</Label>
            <Input
              type="number"
              min="0"
              value={config.days_before || ""}
              onChange={(e) => updateConfig({ days_before: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7 (7 dias após última mensagem)"
            />
          </div>
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            Este gatilho será acionado X dias após a última mensagem enviada ao lead.
          </div>
        </div>
      ) : null}
    </div>
  );
}

