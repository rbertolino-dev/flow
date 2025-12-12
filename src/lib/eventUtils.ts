/**
 * Utilitários para processar eventos do calendário
 */

export interface ExtractedContactInfo {
  name: string;
  phone: string | null;
}

/**
 * Extrai nome e telefone do título do evento
 * Formato esperado: "Nome do Cliente - Telefone" ou "Nome do Cliente (Telefone)"
 * Exemplos:
 * - "João Silva - 11987654321"
 * - "Maria Santos (11987654321)"
 * - "Pedro Costa - (11) 98765-4321"
 */
export function extractContactFromEventTitle(title: string): ExtractedContactInfo {
  if (!title || !title.trim()) {
    return { name: title || "", phone: null };
  }

  // Padrões para encontrar telefone no título
  // Aceita: números, espaços, parênteses, hífens, pontos
  const phonePatterns = [
    /\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/g, // (11) 98765-4321 ou 11987654321
    /\d{10,11}/g, // Apenas números (10 ou 11 dígitos)
  ];

  let phone: string | null = null;
  let name = title;

  // Tentar encontrar telefone usando os padrões
  for (const pattern of phonePatterns) {
    const matches = title.match(pattern);
    if (matches && matches.length > 0) {
      // Pegar o último match (mais provável de ser o telefone completo)
      phone = matches[matches.length - 1].replace(/\D/g, ""); // Remove tudo que não é dígito
      
      // Validar se tem pelo menos 10 dígitos
      if (phone.length >= 10 && phone.length <= 11) {
        // Remover o telefone do nome
        name = title
          .replace(new RegExp(matches[matches.length - 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
          .replace(/[-–—]\s*$/, "") // Remove hífen no final
          .replace(/\s*\([^)]*\)\s*$/, "") // Remove parênteses no final
          .trim();
        break;
      } else {
        phone = null;
      }
    }
  }

  // Se não encontrou telefone, tentar padrões mais específicos
  if (!phone) {
    // Padrão: "Nome - Telefone" ou "Nome (Telefone)"
    const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(\d[\d\s\-\(\)\.]{8,})$/);
    if (dashMatch) {
      name = dashMatch[1].trim();
      phone = dashMatch[2].replace(/\D/g, "");
      if (phone.length < 10 || phone.length > 11) {
        phone = null;
        name = title;
      }
    } else {
      const parenMatch = title.match(/^(.+?)\s*\((\d[\d\s\-\(\)\.]{8,})\)/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        phone = parenMatch[2].replace(/\D/g, "");
        if (phone.length < 10 || phone.length > 11) {
          phone = null;
          name = title;
        }
      }
    }
  }

  return {
    name: name || title,
    phone: phone && phone.length >= 10 && phone.length <= 11 ? phone : null,
  };
}

/**
 * Aplica variáveis em um template de mensagem
 * Variáveis disponíveis: {nome}, {telefone}, {data}, {hora}, {link_meet}
 */
export function applyMessageTemplate(
  template: string,
  variables: {
    nome?: string;
    telefone?: string;
    data?: string;
    hora?: string;
    link_meet?: string;
  }
): string {
  let message = template;

  // Substituir variáveis
  message = message.replace(/\{nome\}/g, variables.nome || "");
  message = message.replace(/\{telefone\}/g, variables.telefone || "");
  message = message.replace(/\{data\}/g, variables.data || "");
  message = message.replace(/\{hora\}/g, variables.hora || "");
  message = message.replace(/\{link_meet\}/g, variables.link_meet || "");

  return message;
}







