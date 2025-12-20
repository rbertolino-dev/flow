import { useState } from "react";
import { FormBuilder } from "@/types/formBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmbedCodeGeneratorProps {
  form: FormBuilder;
  isSurvey?: boolean;
}

export function EmbedCodeGenerator({ form, isSurvey = false }: EmbedCodeGeneratorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://orcbxgajfhgmjobsjlix.supabase.co';
  const formId = form.id;
  const endpoint = isSurvey ? 'submit-survey' : 'submit-form';
  const getEndpoint = isSurvey ? 'get-survey' : 'get-form';
  const idParam = isSurvey ? 'survey_id' : 'form_id';

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({
      title: "Código copiado!",
      description: "Cole o código no seu site.",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  // Código HTML simples
  const htmlCode = `<!-- ${isSurvey ? 'Pesquisa' : 'Formulário'} Agilize -->
<div id="agilize-${isSurvey ? 'survey' : 'form'}-${formId}"></div>
<script>
  (function() {
    var ${isSurvey ? 'surveyId' : 'formId'} = '${formId}';
    var supabaseUrl = '${supabaseUrl}';
    
    // Carregar ${isSurvey ? 'pesquisa' : 'formulário'}
    fetch(supabaseUrl + '/functions/v1/${getEndpoint}?${idParam}=' + ${isSurvey ? 'surveyId' : 'formId'})
      .then(r => r.json())
      .then(data => {
        if (data.${isSurvey ? 'survey' : 'form'}) {
          render${isSurvey ? 'Survey' : 'Form'}(data.${isSurvey ? 'survey' : 'form'}, 'agilize-${isSurvey ? 'survey' : 'form'}-${formId}');
        }
      })
      .catch(err => {
        console.error('Erro ao carregar ${isSurvey ? 'pesquisa' : 'formulário'}:', err);
      });
    
    function render${isSurvey ? 'Survey' : 'Form'}(${isSurvey ? 'survey' : 'form'}, containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      
      var formHtml = '<form id="agilize-${isSurvey ? 'survey' : 'form'}-' + ${isSurvey ? 'surveyId' : 'formId'} + '-form" style="' + 
        'font-family: ' + ${isSurvey ? 'survey' : 'form'}.style.fontFamily + '; ' +
        'background-color: ' + ${isSurvey ? 'survey' : 'form'}.style.backgroundColor + '; ' +
        'color: ' + ${isSurvey ? 'survey' : 'form'}.style.textColor + '; ' +
        'padding: 24px; ' +
        'border-radius: ' + ${isSurvey ? 'survey' : 'form'}.style.borderRadius + ';' +
        '">';
      
      ${isSurvey ? 'survey' : 'form'}.fields.forEach(function(field) {
        formHtml += renderField(field, ${isSurvey ? 'survey' : 'form'}.style);
      });
      
      formHtml += '<button type="submit" style="' +
        'background-color: ' + ${isSurvey ? 'survey' : 'form'}.style.buttonColor + '; ' +
        'color: ' + ${isSurvey ? 'survey' : 'form'}.style.buttonTextColor + '; ' +
        'border: none; ' +
        'padding: 12px 24px; ' +
        'border-radius: ' + ${isSurvey ? 'survey' : 'form'}.style.borderRadius + '; ' +
        'cursor: pointer; ' +
        'width: 100%;' +
        '">${isSurvey ? 'Enviar Resposta' : 'Enviar'}</button>';
      formHtml += '</form>';
      
      container.innerHTML = formHtml;
      
      // Adicionar handler de submit
      document.getElementById('agilize-${isSurvey ? 'survey' : 'form'}-' + ${isSurvey ? 'surveyId' : 'formId'} + '-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(e.target);
        var data = {};
        formData.forEach(function(value, key) {
          data[key] = value;
        });
        
        fetch(supabaseUrl + '/functions/v1/${endpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ${idParam}: ${isSurvey ? 'surveyId' : 'formId'}, data: data })
        })
        .then(r => r.json())
        .then(result => {
          if (result.success) {
            alert('${form.success_message}');
            ${form.redirect_url ? `window.location.href = '${form.redirect_url}';` : ''}
          } else {
            alert('Erro ao enviar ${isSurvey ? 'resposta' : 'formulário'}: ' + (result.error || 'Erro desconhecido'));
          }
        })
        .catch(err => {
          alert('Erro ao enviar ${isSurvey ? 'resposta' : 'formulário'}: ' + err.message);
        });
      });
    }
    
    function renderField(field, style) {
      var html = '<div style="margin-bottom: 16px;">';
      html += '<label style="display: block; margin-bottom: 8px; color: ' + style.textColor + ';">' + 
        field.label + (field.required ? ' <span style="color: ' + style.primaryColor + ';">*</span>' : '') + 
        '</label>';
      
      if (field.type === 'textarea') {
        html += '<textarea name="' + field.name + '" ' + 
          (field.required ? 'required' : '') + 
          ' style="width: 100%; padding: 8px; border: 1px solid ' + style.inputBorderColor + '; border-radius: ' + style.borderRadius + ';"></textarea>';
      } else if (field.type === 'select') {
        html += '<select name="' + field.name + '" ' + 
          (field.required ? 'required' : '') + 
          ' style="width: 100%; padding: 8px; border: 1px solid ' + style.inputBorderColor + '; border-radius: ' + style.borderRadius + ';">';
        if (field.options && field.options.length > 0) {
          field.options.forEach(function(opt) {
            html += '<option value="' + opt + '">' + opt + '</option>';
          });
        }
        html += '</select>';
      } else if (field.type === 'radio') {
        if (field.options && field.options.length > 0) {
          field.options.forEach(function(opt) {
            html += '<div style="margin-bottom: 8px;">';
            html += '<input type="radio" name="' + field.name + '" value="' + opt + '" ' + (field.required ? 'required' : '') + ' id="' + field.id + '-' + opt.replace(/\\s/g, '') + '">';
            html += '<label for="' + field.id + '-' + opt.replace(/\\s/g, '') + '" style="margin-left: 8px; color: ' + style.textColor + ';">' + opt + '</label>';
            html += '</div>';
          });
        }
      } else if (field.type === 'checkbox') {
        html += '<input type="checkbox" name="' + field.name + '" ' + (field.required ? 'required' : '') + ' id="' + field.id + '">';
        html += '<label for="' + field.id + '" style="margin-left: 8px; color: ' + style.textColor + ';">' + field.label + '</label>';
      } else {
        html += '<input type="' + field.type + '" name="' + field.name + '" ' + 
          (field.required ? 'required' : '') + 
          ' placeholder="' + (field.placeholder || '') + '" ' +
          ' style="width: 100%; padding: 8px; border: 1px solid ' + style.inputBorderColor + '; border-radius: ' + style.borderRadius + ';">';
      }
      
      html += '</div>';
      return html;
    }
  })();
</script>`;

  // Código WordPress (shortcode)
  const wordpressCode = isSurvey 
    ? `[agilize_survey id="${formId}"]`
    : `[agilize_form id="${formId}"]`;

  // Código JavaScript standalone
  const jsCode = `// Adicione este script no seu site
(function() {
  const ${isSurvey ? 'surveyId' : 'formId'} = '${formId}';
  const supabaseUrl = '${supabaseUrl}';
  
  // Função para carregar e renderizar o ${isSurvey ? 'pesquisa' : 'formulário'}
  function load${isSurvey ? 'Survey' : 'Form'}(containerId) {
    fetch(\`\${supabaseUrl}/functions/v1/${getEndpoint}?${idParam}=\${${isSurvey ? 'surveyId' : 'formId'}}\`)
      .then(r => r.json())
      .then(data => {
        if (data.${isSurvey ? 'survey' : 'form'}) {
          render${isSurvey ? 'Survey' : 'Form'}(data.${isSurvey ? 'survey' : 'form'}, containerId);
        }
      })
      .catch(err => console.error('Erro ao carregar:', err));
  }
  
  // Função para renderizar o ${isSurvey ? 'pesquisa' : 'formulário'}
  function render${isSurvey ? 'Survey' : 'Form'}(${isSurvey ? 'survey' : 'form'}, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Criar ${isSurvey ? 'pesquisa' : 'formulário'} HTML aqui
    // Similar ao código HTML acima, mas usando JavaScript moderno
    let formHtml = '<form style="font-family: ' + ${isSurvey ? 'survey' : 'form'}.style.fontFamily + '; padding: 24px;">';
    
    ${isSurvey ? 'survey' : 'form'}.fields.forEach(field => {
      formHtml += renderField(field, ${isSurvey ? 'survey' : 'form'}.style);
    });
    
    formHtml += '<button type="submit">${isSurvey ? 'Enviar Resposta' : 'Enviar'}</button></form>';
    container.innerHTML = formHtml;
    
    // Adicionar handler de submit
    container.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {};
      formData.forEach((value, key) => { data[key] = value; });
      
      fetch(\`\${supabaseUrl}/functions/v1/${endpoint}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ${idParam}: ${isSurvey ? 'surveyId' : 'formId'}, data })
      })
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          alert('${form.success_message}');
          ${form.redirect_url ? `if (result.redirect_url) window.location.href = result.redirect_url;` : ''}
        }
      });
    });
  }
  
  function renderField(field, style) {
    // Implementação similar ao HTML acima
    return '<div>...</div>';
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      load${isSurvey ? 'Survey' : 'Form'}('agilize-${isSurvey ? 'survey' : 'form'}-container');
    });
  } else {
    load${isSurvey ? 'Survey' : 'Form'}('agilize-${isSurvey ? 'survey' : 'form'}-container');
  }
})();`;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="html" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="wordpress">WordPress</TabsTrigger>
          <TabsTrigger value="js">JavaScript</TabsTrigger>
        </TabsList>
        
        <TabsContent value="html" className="space-y-2">
          <Label>Cole este código HTML no seu site:</Label>
          <div className="relative">
            <textarea
              readOnly
              value={htmlCode}
              className="w-full h-64 p-3 font-mono text-sm bg-gray-100 rounded border"
            />
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => handleCopy(htmlCode, 'html')}
            >
              {copied === 'html' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="wordpress" className="space-y-2">
          <Label>Para WordPress, adicione este shortcode:</Label>
          <div className="relative">
            <Input readOnly value={wordpressCode} className="font-mono" />
            <Button
              size="sm"
              variant="outline"
              className="absolute top-0 right-0"
              onClick={() => handleCopy(wordpressCode, 'wp')}
            >
              {copied === 'wp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Nota: Você precisará instalar um plugin de shortcode customizado ou adicionar este código ao functions.php do seu tema.
          </p>
        </TabsContent>
        
        <TabsContent value="js" className="space-y-2">
          <Label>Código JavaScript standalone:</Label>
          <div className="relative">
            <textarea
              readOnly
              value={jsCode}
              className="w-full h-64 p-3 font-mono text-sm bg-gray-100 rounded border"
            />
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => handleCopy(jsCode, 'js')}
            >
              {copied === 'js' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

