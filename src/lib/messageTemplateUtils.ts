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

/**
 * Extrai todas as tags dinâmicas de um template (formato {variavel})
 * Suporta tanto {variavel} quanto {{variavel}} para compatibilidade
 * 
 * @param template Template da mensagem
 * @returns Array com os nomes das tags encontradas (em minúsculas)
 */
export function extractDynamicTags(template: string): string[] {
  const tags: string[] = [];
  
  // Procurar por {variavel} (formato usado em broadcast)
  const singleBraceRegex = /\{(\w+)\}/g;
  let match;
  while ((match = singleBraceRegex.exec(template)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Procurar por {{variavel}} (formato usado em contratos)
  const doubleBraceRegex = /\{\{(\w+)\}\}/g;
  while ((match = doubleBraceRegex.exec(template)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Valida se os campos do CSV/lista correspondem às tags do template
 * 
 * @param template Template da mensagem com tags dinâmicas
 * @param csvFields Array com nomes das colunas do CSV
 * @returns Objeto com validação, tags faltando, campos disponíveis e avisos
 */
export function validateTemplateAgainstCSVFields(
  template: string,
  csvFields: string[]
): {
  valid: boolean;
  missingTags: string[];
  availableFields: string[];
  warnings: string[];
} {
  const templateTags = extractDynamicTags(template);
  const normalizedCSVFields = csvFields.map(f => f.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  
  const missingTags: string[] = [];
  const availableFields: string[] = [];
  const warnings: string[] = [];
  
  // Mapear tags para campos CSV possíveis
  const tagToFieldMap: Record<string, string[]> = {
    'nome': ['nome', 'name', 'cliente', 'contato'],
    'empresa': ['empresa', 'company', 'companhia'],
    'nome_empresa': ['nome_empresa', 'nome_da_empresa', 'company_name', 'razao_social', 'razao'],
    'email': ['email', 'e_mail', 'correio', 'e-mail'],
    'cpf': ['cpf'],
    'cnpj': ['cnpj'],
  };
  
  for (const tag of templateTags) {
    // Tags obrigatórias que precisam estar no CSV
    const possibleFields = tagToFieldMap[tag] || [tag];
    const found = possibleFields.some(field => 
      normalizedCSVFields.includes(field) || 
      normalizedCSVFields.some(csvField => csvField.includes(field) || field.includes(csvField))
    );
    
    if (!found) {
      // nome é opcional (pode ser vazio), mas outros campos são importantes
      if (tag !== 'nome') {
        missingTags.push(tag);
      } else {
        warnings.push(`Tag {${tag}} encontrada no template, mas campo correspondente não encontrado no CSV`);
      }
    } else {
      availableFields.push(tag);
    }
  }
  
  return {
    valid: missingTags.length === 0,
    missingTags,
    availableFields,
    warnings,
  };
}