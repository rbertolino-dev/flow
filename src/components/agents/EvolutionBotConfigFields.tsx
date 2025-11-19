import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EvolutionBotConfigFieldsProps {
  values: {
    trigger_type?: string;
    trigger_operator?: string;
    trigger_value?: string;
    expire?: number;
    keyword_finish?: string;
    delay_message?: number;
    unknown_message?: string;
    listening_from_me?: boolean;
    stop_bot_from_me?: boolean;
    keep_open?: boolean;
    debounce_time?: number;
    response_format?: string;
    split_messages?: number;
    function_url?: string;
  };
  onChange: (field: string, value: any) => void;
}

export function EvolutionBotConfigFields({ values, onChange }: EvolutionBotConfigFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          Configuração do Bot Evolution
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Configurações de comportamento do bot na Evolution API</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trigger Type */}
          <div className="space-y-2">
            <Label htmlFor="trigger_type">Tipo de Gatilho</Label>
            <Select
              value={values.trigger_type || 'keyword'}
              onValueChange={(value) => onChange('trigger_type', value)}
            >
              <SelectTrigger id="trigger_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Palavra-chave</SelectItem>
                <SelectItem value="all">Todas as mensagens</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trigger Operator */}
          <div className="space-y-2">
            <Label htmlFor="trigger_operator">Operador</Label>
            <Select
              value={values.trigger_operator || 'contains'}
              onValueChange={(value) => onChange('trigger_operator', value)}
            >
              <SelectTrigger id="trigger_operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="startsWith">Começa com</SelectItem>
                <SelectItem value="endsWith">Termina com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trigger Value */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="trigger_value">Palavra-chave Gatilho</Label>
            <Input
              id="trigger_value"
              value={values.trigger_value || ''}
              onChange={(e) => onChange('trigger_value', e.target.value)}
              placeholder="Ex: atendimento"
            />
          </div>

          {/* Expire */}
          <div className="space-y-2">
            <Label htmlFor="expire">Tempo de Expiração (minutos)</Label>
            <Input
              id="expire"
              type="number"
              value={values.expire || 20}
              onChange={(e) => onChange('expire', parseInt(e.target.value) || 20)}
              min={1}
            />
          </div>

          {/* Keyword Finish */}
          <div className="space-y-2">
            <Label htmlFor="keyword_finish">Palavra para Encerrar</Label>
            <Input
              id="keyword_finish"
              value={values.keyword_finish || '#SAIR'}
              onChange={(e) => onChange('keyword_finish', e.target.value)}
              placeholder="#SAIR"
            />
          </div>

          {/* Delay Message */}
          <div className="space-y-2">
            <Label htmlFor="delay_message">Delay entre Mensagens (ms)</Label>
            <Input
              id="delay_message"
              type="number"
              value={values.delay_message || 1000}
              onChange={(e) => onChange('delay_message', parseInt(e.target.value) || 1000)}
              min={0}
            />
          </div>

          {/* Debounce Time */}
          <div className="space-y-2">
            <Label htmlFor="debounce_time">Debounce (segundos)</Label>
            <Input
              id="debounce_time"
              type="number"
              value={values.debounce_time || 10}
              onChange={(e) => onChange('debounce_time', parseInt(e.target.value) || 10)}
              min={0}
            />
          </div>

          {/* Unknown Message */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="unknown_message">Mensagem de Não Compreensão</Label>
            <Textarea
              id="unknown_message"
              value={values.unknown_message || 'Desculpe, não entendi. Pode repetir?'}
              onChange={(e) => onChange('unknown_message', e.target.value)}
              placeholder="Mensagem quando o bot não entender"
              rows={2}
            />
          </div>

          {/* Response Format */}
          <div className="space-y-2">
            <Label htmlFor="response_format">Response Format</Label>
            <Select
              value={values.response_format || 'text'}
              onValueChange={(value) => onChange('response_format', value)}
            >
              <SelectTrigger id="response_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Split Messages */}
          <div className="space-y-2">
            <Label htmlFor="split_messages">Split Messages</Label>
            <Input
              id="split_messages"
              type="number"
              value={values.split_messages || ''}
              onChange={(e) => onChange('split_messages', parseInt(e.target.value) || undefined)}
              placeholder="Ex: 1000"
              min={0}
            />
            <p className="text-xs text-muted-foreground">Número máximo de caracteres por mensagem</p>
          </div>

          {/* Function URL */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="function_url">URL de Webhook/Bridge (opcional)</Label>
            <Input
              id="function_url"
              value={values.function_url || ''}
              onChange={(e) => onChange('function_url', e.target.value)}
              placeholder="https://seu-backend.com/webhook"
              type="url"
            />
          </div>

          {/* Boolean Switches */}
          <div className="space-y-4 md:col-span-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="listening_from_me">Escutar Mensagens Próprias</Label>
                <p className="text-xs text-muted-foreground">Bot processa mensagens enviadas pelo próprio número</p>
              </div>
              <Switch
                id="listening_from_me"
                checked={values.listening_from_me || false}
                onCheckedChange={(checked) => onChange('listening_from_me', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="stop_bot_from_me">Parar Bot em Mensagens Próprias</Label>
                <p className="text-xs text-muted-foreground">Bot para quando recebe mensagem do próprio número</p>
              </div>
              <Switch
                id="stop_bot_from_me"
                checked={values.stop_bot_from_me || false}
                onCheckedChange={(checked) => onChange('stop_bot_from_me', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="keep_open">Manter Conversa Aberta</Label>
                <p className="text-xs text-muted-foreground">Não encerra automaticamente após resposta</p>
              </div>
              <Switch
                id="keep_open"
                checked={values.keep_open !== false}
                onCheckedChange={(checked) => onChange('keep_open', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
