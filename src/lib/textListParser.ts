/**
 * Utilitário para processar texto colado com lista de contatos
 * Suporta formatos: nome, telefone, empresa (separados por vírgula, ponto-e-vírgula, tab ou quebra de linha)
 */

export interface ParsedTextContact {
  phone: string;
  name?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
  [key: string]: string | undefined;
}

export interface TextParseResult {
  contacts: ParsedTextContact[];
  errors: string[];
}

/**
 * Normaliza número de telefone
 */
function normalizePhone(phone: string): string {
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Se já começa com 55 e tem tamanho correto
  if (digits.startsWith('55')) {
    if (digits.length === 12 || digits.length === 13) {
      return '+' + digits;
    }
  }
  
  // Se tem 10 dígitos: DDD + 8 números (formato antigo ou fixo)
  if (digits.length === 10) {
    return '+55' + digits;
  }
  
  // Se tem 11 dígitos: DDD + 9 + 8 números (celular)
  if (digits.length === 11) {
    return '+55' + digits;
  }
  
  // Se já tem +, retornar como está
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Se não conseguiu normalizar, retornar original
  return phone;
}

/**
 * Detecta o separador usado no texto (vírgula, ponto-e-vírgula, tab ou quebra de linha)
 */
function detectSeparator(line: string): string {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Parseia texto colado com lista de contatos
 * Formatos suportados:
 * - nome, telefone, empresa
 * - telefone, nome, empresa
 * - nome telefone empresa (separados por espaço)
 * - Uma linha por contato
 */
export function parseTextList(text: string): TextParseResult {
  const errors: string[] = [];
  const contacts: ParsedTextContact[] = [];
  
  if (!text || !text.trim()) {
    return {
      contacts: [],
      errors: ['Texto vazio'],
    };
  }
  
  // Dividir em linhas
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return {
      contacts: [],
      errors: ['Nenhuma linha encontrada'],
    };
  }
  
  // Processar cada linha
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detectar separador
    const separator = detectSeparator(line);
    const parts = line.split(separator).map(part => part.trim().replace(/^"|"$/g, ''));
    
    if (parts.length < 2) {
      // Tentar separar por espaços múltiplos
      const spaceParts = line.split(/\s{2,}/).map(part => part.trim());
      if (spaceParts.length >= 2) {
        parts.push(...spaceParts);
      } else {
        errors.push(`Linha ${i + 1}: Formato inválido (mínimo: nome e telefone)`);
        continue;
      }
    }
    
    // Tentar identificar campos automaticamente
    let phone = '';
    let name = '';
    let empresa = '';
    let nome_empresa = '';
    let email = '';
    
    // Estratégia 1: Primeiro campo é telefone (se tem muitos dígitos)
    // Estratégia 2: Primeiro campo é nome (se tem letras)
    // Estratégia 3: Assumir ordem: nome, telefone, empresa
    
    const firstPart = parts[0];
    const secondPart = parts[1] || '';
    const thirdPart = parts[2] || '';
    const fourthPart = parts[3] || '';
    
    // Verificar qual campo é telefone
    const phoneRegex = /[\d\s\(\)\-\+]{10,}/;
    
    if (phoneRegex.test(firstPart)) {
      // Primeiro campo é telefone
      phone = normalizePhone(firstPart);
      name = secondPart || '';
      empresa = thirdPart || '';
      nome_empresa = fourthPart || '';
    } else if (phoneRegex.test(secondPart)) {
      // Segundo campo é telefone
      name = firstPart || '';
      phone = normalizePhone(secondPart);
      empresa = thirdPart || '';
      nome_empresa = fourthPart || '';
    } else if (phoneRegex.test(thirdPart)) {
      // Terceiro campo é telefone
      name = firstPart || '';
      empresa = secondPart || '';
      phone = normalizePhone(thirdPart);
      nome_empresa = fourthPart || '';
    } else {
      // Tentar encontrar telefone em qualquer campo
      let foundPhone = false;
      for (const part of parts) {
        if (phoneRegex.test(part)) {
          phone = normalizePhone(part);
          foundPhone = true;
          break;
        }
      }
      
      if (!foundPhone) {
        errors.push(`Linha ${i + 1}: Telefone não encontrado`);
        continue;
      }
      
      // Preencher outros campos na ordem
      const phoneIndex = parts.findIndex(p => phoneRegex.test(p));
      name = parts[phoneIndex > 0 ? 0 : 1] || '';
      empresa = parts[phoneIndex > 1 ? 1 : phoneIndex + 1] || '';
    }
    
    // Verificar se tem email (contém @)
    for (const part of parts) {
      if (part.includes('@')) {
        email = part;
        break;
      }
    }
    
    // Validar telefone
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      errors.push(`Linha ${i + 1}: Telefone inválido (${phone})`);
      continue;
    }
    
    // Criar contato
    const contact: ParsedTextContact = {
      phone,
      name: name || undefined,
      empresa: empresa || undefined,
      nome_empresa: nome_empresa || empresa || undefined,
      email: email || undefined,
    };
    
    contacts.push(contact);
  }
  
  return {
    contacts,
    errors,
  };
}

/**
 * Gera exemplo de formato de texto para colar
 */
export function generateTextListExample(): string {
  return `João Silva, 11999999999, Empresa ABC, ABC Ltda
Maria Santos, 11888888888, Empresa XYZ
Pedro Costa, 11777777777, Minha Empresa, Minha Empresa LTDA, pedro@empresa.com`;
}
