import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Survey } from "@/types/survey";
import { FormField } from "@/types/formBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function PublicSurvey() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");

  useEffect(() => {
    if (!slug) {
      setError("Pesquisa não encontrada");
      setLoading(false);
      return;
    }

    const loadSurvey = async () => {
      try {
        // Buscar pesquisa pelo slug usando edge function (pública)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ogeljmbhqxpfjbpnbwog.supabase.co';
        
        // Fazer requisição com tratamento de erro
        const response = await fetch(`${supabaseUrl}/functions/v1/get-survey?survey_slug=${encodeURIComponent(slug || '')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Erro ao carregar pesquisa";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || `Erro ${response.status}: ${response.statusText}`;
          }
          setError(errorMessage);
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (!result.success || !result.survey) {
          console.error("Erro ao carregar pesquisa:", result);
          setError(result.error || "Pesquisa não encontrada ou inativa");
          setLoading(false);
          return;
        }

        const surveyData = result.survey as Survey;
        console.log("Pesquisa carregada:", surveyData);
        setSurvey(surveyData);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar pesquisa");
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ogeljmbhqxpfjbpnbwog.supabase.co';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: survey.id,
          data: formData,
          respondent_name: survey.collect_respondent_info ? respondentName : null,
          respondent_email: survey.collect_respondent_info ? respondentEmail : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        if (survey.redirect_url) {
          setTimeout(() => {
            window.location.href = survey.redirect_url!;
          }, 2000);
        }
      } else {
        setError(result.error || "Erro ao enviar resposta");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar resposta");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const baseStyle = {
      fontFamily: survey?.style.fontFamily || "Inter, sans-serif",
      fontSize: survey?.style.fontSize || "16px",
      borderRadius: survey?.style.borderRadius || "8px",
      borderColor: survey?.style.inputBorderColor || "#e2e8f0",
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: survey?.style.textColor }}>
              {field.label} {field.required && <span style={{ color: survey?.style.primaryColor }}>*</span>}
            </Label>
            <Input
              type={field.type}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              style={baseStyle}
              className="w-full"
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: survey?.style.textColor }}>
              {field.label} {field.required && <span style={{ color: survey?.style.primaryColor }}>*</span>}
            </Label>
            <Textarea
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              style={baseStyle}
              className="w-full"
              rows={4}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: survey?.style.textColor }}>
              {field.label} {field.required && <span style={{ color: survey?.style.primaryColor }}>*</span>}
            </Label>
            <Select
              value={formData[field.name] || ''}
              onValueChange={(value) => setFormData({ ...formData, [field.name]: value })}
              required={field.required}
            >
              <SelectTrigger style={baseStyle} className="w-full">
                <SelectValue placeholder={field.placeholder || 'Selecione...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, idx) => (
                  <SelectItem key={idx} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formData[field.name] || false}
              onCheckedChange={(checked) => setFormData({ ...formData, [field.name]: checked })}
              required={field.required}
            />
            <Label htmlFor={field.id} style={{ color: survey?.style.textColor }}>
              {field.label} {field.required && <span style={{ color: survey?.style.primaryColor }}>*</span>}
            </Label>
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: survey?.style.textColor }}>
              {field.label} {field.required && <span style={{ color: survey?.style.primaryColor }}>*</span>}
            </Label>
            <RadioGroup
              value={formData[field.name] || ''}
              onValueChange={(value) => setFormData({ ...formData, [field.name]: value })}
              required={field.required}
            >
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${idx}`} />
                  <Label htmlFor={`${field.id}-${idx}`} style={{ color: survey?.style.textColor }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-gray-600">Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error || "Pesquisa não encontrada"}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Resposta Enviada!</h2>
            <p className="text-gray-600 mb-4">{survey.success_message}</p>
            {survey.redirect_url && (
              <p className="text-sm text-gray-500">Redirecionando...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const buttonStyle = {
    backgroundColor: survey.style.buttonStyle === 'filled' ? survey.style.buttonColor : 'transparent',
    color: survey.style.buttonStyle === 'filled' ? survey.style.buttonTextColor : survey.style.buttonColor,
    border: survey.style.buttonStyle === 'outlined' ? `2px solid ${survey.style.buttonColor}` : 'none',
    borderRadius: survey.style.borderRadius,
    fontFamily: survey.style.fontFamily,
    fontSize: survey.style.fontSize,
    padding: '12px 24px',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card style={{
          backgroundColor: survey.style.backgroundColor,
          color: survey.style.textColor,
          fontFamily: survey.style.fontFamily,
        }}>
          <CardHeader>
            <CardTitle style={{ color: survey.style.textColor, fontSize: '1.5rem' }}>
              {survey.name}
            </CardTitle>
            {survey.description && (
              <CardDescription style={{ color: survey.style.secondaryColor }}>
                {survey.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {survey.collect_respondent_info && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold" style={{ color: survey.style.textColor }}>
                    Seus Dados (Opcional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome</Label>
                      <Input
                        type="text"
                        value={respondentName}
                        onChange={(e) => setRespondentName(e.target.value)}
                        placeholder="Seu nome (opcional)"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={respondentEmail}
                        onChange={(e) => setRespondentEmail(e.target.value)}
                        placeholder="Seu email (opcional)"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {survey.fields.sort((a, b) => (a.order || 0) - (b.order || 0)).map(renderField)}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                style={buttonStyle}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Resposta"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

