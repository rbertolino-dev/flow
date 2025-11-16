import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Key } from 'lucide-react';

interface OpenAIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenAIConfigDialog({ open, onOpenChange }: OpenAIConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Como configurar a OpenAI
          </DialogTitle>
          <DialogDescription>
            A sincronização usa a variável de ambiente <code>OPENAI_API_KEY</code> configurada no Lovable Cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2 text-sm text-blue-900">
          <p className="font-medium">Passo a passo (Lovable Cloud)</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Abra o Lovable Cloud e vá em <strong>Settings → Environment Variables</strong>.</li>
            <li>Adicione/edite a variável <code>OPENAI_API_KEY</code> com a sua chave (<code>sk-...</code>).</li>
            <li>Reimplante/reinicie o projeto para aplicar.</li>
          </ol>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2 text-sm text-yellow-900">
          <p className="font-medium">Importante</p>
          <ul className="list-disc list-inside space-y-1">
            <li>A chave é única por ambiente/organização.</li>
            <li>Nunca compartilhe a chave em chats, tickets ou commits.</li>
            <li>Se a chave não estiver configurada, o botão "OpenAI" mostrará um erro de configuração.</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Dúvidas? Consulte <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">
            platform.openai.com/api-keys
          </a> para gerar uma nova chave.
        </p>
      </DialogContent>
    </Dialog>
  );
}
