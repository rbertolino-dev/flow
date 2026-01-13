/**
 * Utilitários para substituição de tags em templates de campanhas de broadcast
 */

export interface BroadcastContactData {
  nome?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  [key: string]: string | undefined; // Para campos customizados
}

/**
 * Substitui todas as tags dinâmicas em uma mensagem de template
 * Suporta: {nome}, {empresa}, {nome_empresa}, {email}, {cpf}, {cnpj}, e campos customizados
 * 
 * @param template Template da mensagem com tags
 * @param contactData Dados do contato para substituição
 * @returns Mensagem com tags substituídas
 */
export function replaceBroadcastTemplateTags(
  template: string,
  contactData: BroadcastContactData
): string {
  let result = template;

  // Mapeamento de tags padrão
  // CRÍTICO: Usar ?? ao invés de || para garantir que null/undefined virem string vazia
  // Mesma lógica da tag {nome} que funciona corretamente
  const replacements: Record<string, string> = {
    nome: contactData.nome ?? "",
    // CRÍTICO: Usar ?? para empresa (mesma lógica de nome)
    // Se empresa for null/undefined, tentar nome_empresa, senão string vazia
    empresa: (contactData.empresa ?? contactData.nome_empresa) ?? "",
    nome_empresa: (contactData.nome_empresa ?? contactData.empresa) ?? "",
    email: contactData.email ?? "",
    cpf: contactData.cpf ?? "",
    cnpj: contactData.cnpj ?? "",
  };

  // Adicionar campos customizados
  // CRÍTICO: Usar ?? ao invés de || para garantir que null/undefined virem string vazia
  Object.entries(contactData).forEach(([key, value]) => {
    if (!['nome', 'empresa', 'nome_empresa', 'email', 'cpf', 'cnpj'].includes(key)) {
      replacements[key] = value ?? "";
    }
  });

  // Substituir todas as tags {tag} ou {{tag}}
  result = result.replace(/\{\{?(\w+)\}?\}/gi, (match, key) => {
    const normalizedKey = key.toLowerCase();
    const replacement = replacements[normalizedKey];
    
    // LOG CRÍTICO para debug da tag {empresa}
    if (normalizedKey === 'empresa') {
      console.log('🔍 [replaceBroadcastTemplateTags] Substituindo tag {empresa}:', {
        match,
        normalizedKey,
        replacement,
        replacementType: typeof replacement,
        replacementLength: replacement?.length,
        availableReplacements: Object.keys(replacements),
        contactData_empresa: contactData.empresa,
        contactData_nome_empresa: contactData.nome_empresa,
        contactData,
      });
    }
    
    // CRÍTICO: Se replacement for undefined, retornar string vazia ao invés de match
    // Isso garante que tags sem dados sejam removidas (não ficam no texto)
    return replacement !== undefined ? replacement : "";
  });

  return result;
}
