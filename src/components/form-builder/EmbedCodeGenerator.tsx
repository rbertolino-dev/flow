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
}

export function EmbedCodeGenerator({ form }: EmbedCodeGeneratorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://orcbxgajfhgmjobsjlix.supabase.co';
  const formId = form.id;

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
  const htmlCode = `<!-- Formulário Agilize -->
<div id="agilize-form-${formId}"></div>
<script>
  (function() {
    var formId = '${formId}';
    var supabaseUrl = '${supabaseUrl}';
    var script = document.createElement('script');
    script.src = supabaseUrl + '/functions/v1/submit-form?form_id=' + formId;
    script.async = true;
    document.head.appendChild(script);
    
    // Carregar formulário
    fetch(supabaseUrl + '/functions/v1/get-form?form_id=' + formId)
      .then(r => r.json())
      .then(data => {
        if (data.form) {
          renderForm(data.form, 'agilize-form-${formId}');
        }
      });
    
    function renderForm(form, containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      
      var formHtml = '<form id="agilize-form-' + formId + '-form" style="' + 
        'font-family: ' + form.style.fontFamily + '; ' +
        'background-color: ' + form.style.backgroundColor + '; ' +
        'color: ' + form.style.textColor + '; ' +
        'padding: 24px; ' +
        'border-radius: ' + form.style.borderRadius + ';' +
        '">';
      
      form.fields.forEach(function(field) {
        formHtml += renderField(field, form.style);
      });
      
      formHtml += '<button type="submit" style="' +
        'background-color: ' + form.style.buttonColor + '; ' +
        'color: ' + form.style.buttonTextColor + '; ' +
        'border: none; ' +
        'padding: 12px 24px; ' +
        'border-radius: ' + form.style.borderRadius + '; ' +
        'cursor: pointer; ' +
        'width: 100%;' +
        '">Enviar</button>';
      formHtml += '</form>';
      
      container.innerHTML = formHtml;
      
      // Adicionar handler de submit
      document.getElementById('agilize-form-' + formId + '-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(e.target);
        var data = {};
        formData.forEach(function(value, key) {
          data[key] = value;
        });
        
        fetch(supabaseUrl + '/functions/v1/submit-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_id: formId, data: data })
        })
        .then(r => r.json())
        .then(result => {
          if (result.success) {
            alert('${form.success_message}');
            ${form.redirect_url ? `window.location.href = '${form.redirect_url}';` : ''}
          } else {
            alert('Erro ao enviar formulário');
          }
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
        field.options.forEach(function(opt) {
          html += '<option value="' + opt + '">' + opt + '</option>';
        });
        html += '</select>';
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
  const wordpressCode = `[agilize_form id="${formId}"]`;

  // Código JavaScript standalone
  const jsCode = `// Adicione este script no seu site
(function() {
  const formId = '${formId}';
  const supabaseUrl = '${supabaseUrl}';
  
  // Função para carregar e renderizar o formulário
  function loadForm(containerId) {
    fetch(\`\${supabaseUrl}/functions/v1/get-form?form_id=\${formId}\`)
      .then(r => r.json())
      .then(data => {
        if (data.form) {
          renderForm(data.form, containerId);
        }
      });
  }
  
  // Função para renderizar o formulário
  function renderForm(form, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Criar formulário HTML aqui (similar ao código HTML acima)
    // ... código de renderização ...
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadForm('agilize-form-container');
    });
  } else {
    loadForm('agilize-form-container');
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

