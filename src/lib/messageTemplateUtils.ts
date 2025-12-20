// Utilitários para trabalhar com templates de mensagem WhatsApp

export interface MessageTemplateVariables {
  nome?: string;
  numero_contrato?: string;
  link_assinatura?: string;
  telefone?: string;
  email?: string;
  empresa?: string;
  [key: string]: string | undefined; // Permite variáveis customizadas
}

/**
 * Substitui variáveis em um template de mensagem
 * Variáveis devem estar no formato {{nome_variavel}}
 * 
 * @param template Template da mensagem com variáveis
 * @param variables Objeto com os valores das variáveis
 * @returns Mensagem com variáveis substituídas
 */
export function replaceTemplateVariables(
  template: string,
  variables: MessageTemplateVariables
): string {
  let result = template;

  // Substituir cada variável
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || `{{${key}}}`);
  }

  return result;
}

/**
 * Extrai todas as variáveis de um template
 * 
 * @param template Template da mensagem
 * @returns Array com os nomes das variáveis encontradas
 */
export function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Template padrão de mensagem WhatsApp para contratos
 */
export const DEFAULT_CONTRACT_MESSAGE_TEMPLATE = `📄 Contrato {{numero_contrato}}

Olá {{nome}}, segue o contrato para sua análise.

✍️ Para assinar digitalmente, acesse:
{{link_assinatura}}

Ou você pode baixar o PDF anexado e assinar manualmente.`;

/**
 * Valida se um template contém variáveis obrigatórias
 * 
 * @param template Template da mensagem
 * @param requiredVariables Array com nomes de variáveis obrigatórias
 * @returns true se todas as variáveis obrigatórias estão presentes
 */
export function validateTemplate(
  template: string,
  requiredVariables: string[] = ['numero_contrato', 'link_assinatura']
): { valid: boolean; missing: string[] } {
  const foundVariables = extractTemplateVariables(template);
  const missing = requiredVariables.filter(v => !foundVariables.includes(v));

  return {
    valid: missing.length === 0,
    missing,
  };
}

