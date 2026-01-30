/**
 * Utilitário para processar CSV com múltiplos campos
 * Suporta campos dinâmicos como: telefone, nome, empresa, nome_empresa, email, etc.
 */

export interface ParsedCSVContact {
  phone: string;
  name?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  [key: string]: string | undefined; // Permite campos customizados
}

export interface CSVParseResult {
  contacts: ParsedCSVContact[];
  columns: string[];
  errors: string[];
}

/**
 * Detecta o separador do CSV (vírgula, ponto-e-vírgula ou tab)
 */
function detectSeparator(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Normaliza nome de coluna para formato padrão
 * Ex: "Nome", "nome", "NOME" -> "nome"
 *     "Nome da Empresa", "nome_empresa" -> "nome_empresa"
 */
function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Mapeia nomes de colunas comuns para nomes padronizados
 */
const columnMapping: Record<string, string> = {
  'telefone': 'phone',
  'phone': 'phone',
  'celular': 'phone',
  'whatsapp': 'phone',
  'numero': 'phone',
  'numero_telefone': 'phone',
  
  'nome': 'name',
  'name': 'name',
  'cliente': 'name',
  'contato': 'name',
  
  'empresa': 'empresa',
  'company': 'empresa',
  'companhia': 'empresa',
  
  'nome_empresa': 'nome_empresa',
  'nome_da_empresa': 'nome_empresa',
  'company_name': 'nome_empresa',
  'razao_social': 'nome_empresa',
  
  'email': 'email',
  'e_mail': 'email',
  'correio': 'email',
  
  'cpf': 'cpf',
  'cnpj': 'cnpj',
};

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
 * Parseia um arquivo CSV com múltiplos campos
 */
export function parseCSVFile(
  csvText: string,
  options: {
    hasHeader?: boolean;
    requiredColumns?: string[];
  } = {}
): CSVParseResult {
  const { hasHeader = true, requiredColumns = ['phone'] } = options;
  
  const lines = csvText.split('\n').filter(line => line.trim());
  const errors: string[] = [];
  const contacts: ParsedCSVContact[] = [];
  
  if (lines.length === 0) {
    return {
      contacts: [],
      columns: [],
      errors: ['Arquivo CSV vazio'],
    };
  }
  
  // Detectar separador
  const separator = detectSeparator(lines[0]);
  
  // Processar header
  const headerLine = hasHeader ? lines[0] : null;
  const dataStartIndex = hasHeader ? 1 : 0;
  
  let columns: string[] = [];
  const columnMap: Record<string, string> = {}; // Mapeia índice da coluna para nome normalizado
  
  if (headerLine) {
    const headerColumns = headerLine.split(separator).map(col => col.trim());
    columns = headerColumns;
    
    // Criar mapa de colunas normalizadas
    headerColumns.forEach((col, index) => {
      const normalized = normalizeColumnName(col);
      const mapped = columnMapping[normalized] || normalized;
      columnMap[index] = mapped;
    });
    
    // Verificar se tem coluna de telefone
    const hasPhoneColumn = Object.values(columnMap).includes('phone');
    if (!hasPhoneColumn) {
      errors.push('CSV deve ter uma coluna de telefone (telefone, phone, celular, whatsapp, etc)');
    }
  } else {
    // Sem header, assumir primeira coluna é telefone
    columns = ['telefone'];
    columnMap[0] = 'phone';
  }
  
  // Processar linhas de dados
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(separator).map(val => val.trim().replace(/^"|"$/g, ''));
    
    // Criar objeto de contato
    const contact: ParsedCSVContact = {
      phone: '',
    };
    
    // Mapear valores para campos
    values.forEach((value, index) => {
      const fieldName = columnMap[index] || `field_${index}`;
      if (fieldName === 'phone') {
        contact.phone = normalizePhone(value);
      } else {
        contact[fieldName] = value || undefined;
      }
    });
    
    // Validar telefone obrigatório
    if (!contact.phone || contact.phone.length < 10) {
      errors.push(`Linha ${i + 1}: Telefone inválido ou ausente`);
      continue;
    }
    
    // Validar colunas obrigatórias
    let hasAllRequired = true;
    for (const requiredCol of requiredColumns) {
      if (requiredCol === 'phone' && !contact.phone) {
        hasAllRequired = false;
        break;
      } else if (requiredCol !== 'phone' && !contact[requiredCol]) {
        hasAllRequired = false;
        break;
      }
    }
    
    if (!hasAllRequired) {
      errors.push(`Linha ${i + 1}: Faltam campos obrigatórios`);
      continue;
    }
    
    contacts.push(contact);
  }
  
  return {
    contacts,
    columns: hasHeader ? columns : [],
    errors,
  };
}

/**
 * Gera template CSV de exemplo
 */
export function generateCSVTemplate(columns: string[] = ['telefone', 'nome', 'empresa', 'nome_empresa', 'email']): string {
  return columns.join(',') + '\n' +
    '+5511999999999,João Silva,Empresa ABC,ABC Ltda,joao@empresa.com\n' +
    '+5511888888888,Maria Santos,Empresa XYZ,XYZ S.A.,maria@empresa.com';
}
