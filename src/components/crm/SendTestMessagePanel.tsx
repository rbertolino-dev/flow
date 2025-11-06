import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SendTestMessagePanel({ config }: { config: any }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("Olá! Esta é uma mensagem de teste do CRM.");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const normalizePhoneNumber = (phone: string) => {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Se não começar com código do país, adicionar 55 (Brasil)
    if (cleaned.length === 11 || cleaned.length === 10) {
      return '55' + cleaned;
    }
    
    return cleaned;
  };

  const sendTestMessage = async () => {
    if (!config || !phoneNumber) {
      toast({
        title: "❌ Erro",
        description: "Configure a Evolution API e informe um número de telefone.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const baseUrl = config.api_url.replace(/\/(manager|dashboard|app)$/, '');
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

      console.log('📤 Enviando mensagem de teste para:', remoteJid);

      const response = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key || '',
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Mensagem enviada:', data);

      setResult({
        success: true,
        message: "Mensagem enviada com sucesso! Aguarde alguns segundos e o webhook deve criar um lead automaticamente."
      });

      toast({
        title: "✅ Mensagem enviada!",
        description: "Verifique se o lead aparece no funil em alguns segundos.",
      });

      // Limpar o formulário
      setPhoneNumber("");
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      setResult({
        success: false,
        message: error.message || "Erro ao enviar mensagem de teste"
      });

      toast({
        title: "❌ Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Enviar Mensagem Teste
        </CardTitle>
        <CardDescription>
          Envie uma mensagem de teste para simular a chegada de um novo lead via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Número de Telefone</Label>
          <Input
            id="phone"
            placeholder="11999999999 ou 5511999999999"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground">
            Digite apenas números. O código do país (55) será adicionado automaticamente se necessário.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Mensagem</Label>
          <Input
            id="message"
            placeholder="Digite a mensagem de teste"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
          />
        </div>

        <Button 
          onClick={sendTestMessage} 
          disabled={sending || !phoneNumber || !message || !config}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar Mensagem Teste
            </>
          )}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5" />
              )}
              <AlertDescription className="text-sm">
                {result.message}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Alert>
          <AlertDescription className="text-xs">
            💡 <strong>Como funciona:</strong> A mensagem será enviada via Evolution API para o número especificado. 
            Quando a resposta chegar, o webhook criará automaticamente um novo lead no CRM.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}