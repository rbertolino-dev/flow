import { useState } from "react";
import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Phone, Mail, MessageSquare } from "lucide-react";

interface LandingPageFormProps {
  landingPage: LandingPagePublicData;
  selectedProduct?: string | null;
}

export function LandingPageForm({ landingPage, selectedProduct }: LandingPageFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
  });
  const primaryColor = landingPage.primary_color || '#3b82f6';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fields = landingPage.form_fields ?? { name: true, phone: true, email: false, message: false };
    const needName = fields.name && (!formData.name || !formData.name.trim());
    const needPhone = fields.phone && (!formData.phone || !formData.phone.trim());
    if (needName || needPhone) {
      const missing: string[] = [];
      if (needName) missing.push('Nome');
      if (needPhone) missing.push('WhatsApp');
      toast({
        title: "Erro",
        description: `${missing.join(' e ')} ${missing.length > 1 ? 'são obrigatórios' : 'é obrigatório'}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let ipAddress: string | null = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch {
        // Ignorar se não conseguir obter IP
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-landing-page-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landing_page_id: landingPage.id,
          organization_id: landingPage.organization_id,
          name: (fields.name ? formData.name.trim() : null) || 'Não informado',
          phone: (fields.phone ? formData.phone.trim() : null) || 'Não informado',
          email: (fields.email ? formData.email.trim() : null) || null,
          message: (fields.message ? formData.message.trim() : null) || null,
          product_id: selectedProduct || null,
          product_name: selectedProduct
            ? landingPage.items.find(i => i.product_id === selectedProduct)?.product?.name || null
            : null,
          page_url: window.location.href,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          form_destination: landingPage.form_destination,
        }),
      });

      let result: { success?: boolean; error?: string };
      try {
        result = await response.json();
      } catch {
        throw new Error(response.ok ? 'Resposta inválida do servidor' : 'Erro de conexão. Tente novamente.');
      }
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar formulário');
      }
      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar formulário');
      }

      if (landingPage.form_destination === 'email' && landingPage.form_notification_email) {
        console.log("Enviar email para:", landingPage.form_notification_email);
      }

      toast({
        title: "Mensagem enviada!",
        description: "Entraremos em contato em breve",
      });

      setFormData({ name: '', phone: '', email: '', message: '' });
    } catch (error: any) {
      console.error("Erro ao enviar formulário:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto min-w-0">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          {landingPage.form_title || 'Receba um orçamento'}
        </h2>
        <p className="text-gray-600">Preencha o formulário e retornaremos em breve</p>
        <div className="w-16 h-1 rounded-full mx-auto mt-4" style={{ backgroundColor: primaryColor }} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-5">
          {landingPage.form_fields?.name && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" style={{ color: primaryColor }} />
                Nome *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Seu nome completo"
                className="h-12 min-h-[48px] rounded-xl border-2 border-gray-200 focus:border-gray-400 px-4"
              />
            </div>
          )}

          {landingPage.form_fields?.phone && (
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" style={{ color: primaryColor }} />
                WhatsApp *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="(11) 99999-9999"
                className="h-12 min-h-[48px] rounded-xl border-2 border-gray-200 focus:border-gray-400 px-4"
              />
            </div>
          )}

          {landingPage.form_fields?.email && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="h-4 w-4" style={{ color: primaryColor }} />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                className="h-12 min-h-[48px] rounded-xl border-2 border-gray-200 focus:border-gray-400 px-4"
              />
            </div>
          )}

          {landingPage.form_fields?.message && (
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
                Mensagem
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Conte-nos sobre seu interesse..."
                rows={4}
                className="rounded-xl border-2 border-gray-200 focus:border-gray-400 px-4 py-3 resize-none min-h-[100px]"
              />
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full landing-page-premium btn-cta-lift h-14 min-h-[48px] rounded-xl text-base font-semibold"
          disabled={submitting}
          style={{ backgroundColor: primaryColor, color: 'white' }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Enviar Mensagem
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
