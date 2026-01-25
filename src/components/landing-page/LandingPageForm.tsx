import { useState } from "react";
import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "Erro",
        description: "Nome e WhatsApp são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Obter IP do cliente (via edge function ou header)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip;

      // Criar lead na landing_page_leads
      const { data: leadData, error: leadError } = await supabase
        .from('landing_page_leads')
        .insert({
          landing_page_id: landingPage.id,
          organization_id: landingPage.organization_id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          message: formData.message.trim() || null,
          product_id: selectedProduct || null,
          product_name: selectedProduct 
            ? landingPage.items.find(i => i.product_id === selectedProduct)?.product?.name || null
            : null,
          source: 'landing_page',
          page_url: window.location.href,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Se destino é leads, criar lead no CRM também
      if (landingPage.form_destination === 'leads') {
        // Criar lead no sistema de leads
        const { error: crmLeadError } = await supabase
          .from('leads')
          .insert({
            organization_id: landingPage.organization_id,
            user_id: landingPage.organization_id, // Usar organization_id como fallback
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            source: 'landing_page',
            status: 'new',
            notes: formData.message.trim() || null,
          });

        if (crmLeadError) {
          console.error("Erro ao criar lead no CRM:", crmLeadError);
          // Não falhar o formulário se apenas o CRM falhar
        }
      }

      // Se destino é email, enviar email (via edge function)
      if (landingPage.form_destination === 'email' && landingPage.form_notification_email) {
        // TODO: Implementar envio de email via edge function
        console.log("Enviar email para:", landingPage.form_notification_email);
      }

      toast({
        title: "Mensagem enviada!",
        description: "Entraremos em contato em breve",
      });

      // Limpar formulário
      setFormData({
        name: '',
        phone: '',
        email: '',
        message: '',
      });
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
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">
        {landingPage.form_title || 'Receba um orçamento'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {landingPage.form_fields?.name && (
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Seu nome completo"
            />
          </div>
        )}

        {landingPage.form_fields?.phone && (
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              placeholder="(11) 99999-9999"
            />
          </div>
        )}

        {landingPage.form_fields?.email && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@email.com"
            />
          </div>
        )}

        {landingPage.form_fields?.message && (
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Conte-nos sobre seu interesse..."
              rows={4}
            />
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitting}
          style={{
            backgroundColor: landingPage.primary_color || '#3b82f6',
            color: 'white',
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar Mensagem'
          )}
        </Button>
      </form>
    </div>
  );
}
