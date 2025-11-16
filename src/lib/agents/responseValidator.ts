/**
 * Validador de Respostas de Agentes IA
 * 
 * Valida respostas dos agentes ANTES de enviá-las aos clientes.
 * Detecta erros comuns como URLs inválidas, preços absurdos, CPF/CNPJ inválidos, etc.
 * 
 * CUSTO: ZERO (processamento local, sem chamadas externas)
 */

export interface ValidationResult {
  isValid: boolean;
  shouldBlock: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Valida CPF
 */
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Todos dígitos iguais
  
  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ
 */
function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validação dos dígitos verificadores
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights1[i];
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(12))) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights2[i];
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

/**
 * Valida resposta do agente
 */
export function validateResponse(response: string): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // 1. Detectar URLs suspeitas ou malformadas
  const urls = response.match(/https?:\/\/[^\s]+/g) || [];
  urls.forEach(url => {
    // Verificar se tem domínio válido
    if (!url.includes('.com') && !url.includes('.br') && !url.includes('.net') && !url.includes('.org')) {
      issues.push(`URL_INVALIDA: ${url}`);
    }
    // Verificar se não é muito longa (possível erro)
    if (url.length > 200) {
      warnings.push(`URL_LONGA: ${url.substring(0, 50)}...`);
    }
  });
  
  // 2. Detectar preços absurdos
  const prices = response.match(/R\$\s*[\d.,]+/g) || [];
  prices.forEach(price => {
    const value = parseFloat(
      price.replace(/[^\d,]/g, '').replace(',', '.')
    );
    
    if (value > 50000) {
      issues.push(`PRECO_MUITO_ALTO: ${price} (>${50000})`);
    }
    if (value < 0.01 && value !== 0) {
      warnings.push(`PRECO_MUITO_BAIXO: ${price}`);
    }
  });
  
  // 3. Detectar CPF inválido
  const cpfPattern = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
  const cpfs = response.match(cpfPattern) || [];
  cpfs.forEach(cpf => {
    if (!isValidCPF(cpf)) {
      issues.push(`CPF_INVALIDO: ${cpf}`);
    }
  });
  
  // 4. Detectar CNPJ inválido
  const cnpjPattern = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  const cnpjs = response.match(cnpjPattern) || [];
  cnpjs.forEach(cnpj => {
    if (!isValidCNPJ(cnpj)) {
      issues.push(`CNPJ_INVALIDO: ${cnpj}`);
    }
  });
  
  // 5. Detectar palavras de incerteza (indicam que agente não tem certeza)
  const uncertaintyWords = [
    'acho que',
    'talvez',
    'pode ser',
    'provavelmente',
    'não tenho certeza',
    'não sei ao certo',
  ];
  
  uncertaintyWords.forEach(word => {
    if (response.toLowerCase().includes(word)) {
      warnings.push(`INCERTEZA: "${word}"`);
    }
  });
  
  // 6. Detectar emails inválidos
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = response.match(emailPattern) || [];
  emails.forEach(email => {
    // Verificar se domínio parece válido
    if (!email.includes('.com') && !email.includes('.br') && !email.includes('.net')) {
      warnings.push(`EMAIL_SUSPEITO: ${email}`);
    }
  });
  
  // 7. Detectar telefones malformados
  const phonePattern = /\(?\d{2}\)?\s*\d{4,5}-?\d{4}/g;
  const phones = response.match(phonePattern) || [];
  phones.forEach(phone => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      warnings.push(`TELEFONE_INVALIDO: ${phone}`);
    }
  });
  
  // Determinar se deve bloquear envio
  const criticalIssues = issues.filter(i => 
    i.startsWith('CPF_INVALIDO') || 
    i.startsWith('CNPJ_INVALIDO') ||
    i.startsWith('PRECO_MUITO_ALTO')
  );
  
  return {
    isValid: issues.length === 0,
    shouldBlock: criticalIssues.length > 0,
    issues,
    warnings,
  };
}

/**
 * Valida resposta JSON do agente (quando usando response_format: json_object)
 */
export interface AgentJsonResponse {
  resposta: string;
  confianca: number;
  precisa_escalacao: boolean;
}

export function parseAndValidateJsonResponse(jsonString: string): {
  success: boolean;
  data?: AgentJsonResponse;
  error?: string;
  validation?: ValidationResult;
} {
  try {
    const parsed = JSON.parse(jsonString) as AgentJsonResponse;
    
    // Validar estrutura
    if (!parsed.resposta || typeof parsed.resposta !== 'string') {
      return {
        success: false,
        error: 'Campo "resposta" ausente ou inválido',
      };
    }
    
    if (typeof parsed.confianca !== 'number' || parsed.confianca < 0 || parsed.confianca > 100) {
      return {
        success: false,
        error: 'Campo "confianca" deve ser número entre 0-100',
      };
    }
    
    if (typeof parsed.precisa_escalacao !== 'boolean') {
      return {
        success: false,
        error: 'Campo "precisa_escalacao" deve ser boolean',
      };
    }
    
    // Validar conteúdo da resposta
    const validation = validateResponse(parsed.resposta);
    
    return {
      success: true,
      data: parsed,
      validation,
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON inválido: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
    };
  }
}

/**
 * Detecta se agente deve ser escalado para humano baseado na resposta JSON
 */
export function shouldEscalateToHuman(
  jsonResponse: AgentJsonResponse,
  validation?: ValidationResult
): boolean {
  // Escalar se agente explicitamente pediu
  if (jsonResponse.precisa_escalacao) {
    return true;
  }
  
  // Escalar se confiança muito baixa
  if (jsonResponse.confianca < 70) {
    return true;
  }
  
  // Escalar se validação detectou problemas críticos
  if (validation?.shouldBlock) {
    return true;
  }
  
  return false;
}

