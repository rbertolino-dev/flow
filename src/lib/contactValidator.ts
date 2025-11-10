/**
 * Utilitários para validação e normalização de contatos
 * Valida números brasileiros e verifica WhatsApp via Evolution API
 */

export interface ParsedContact {
  phone: string;
  name?: string;
  valid: boolean;
  error?: string;
}

export interface ValidationResult {
  validContacts: ParsedContact[];
  invalidContacts: ParsedContact[];
  whatsappValidated: ParsedContact[];
  whatsappRejected: ParsedContact[];
}

/**
 * Códigos de países da América Latina suportados
 */
const LATIN_AMERICA_CODES: { [key: string]: { name: string; minLength: number; maxLength: number } } = {
  "54": { name: "Argentina", minLength: 12, maxLength: 13 }, // +54 9 11 XXXX-XXXX
  "55": { name: "Brasil", minLength: 12, maxLength: 13 }, // +55 DD 9XXXX-XXXX
  "56": { name: "Chile", minLength: 11, maxLength: 12 }, // +56 9 XXXX XXXX
  "57": { name: "Colômbia", minLength: 12, maxLength: 13 }, // +57 3XX XXX XXXX
  "58": { name: "Venezuela", minLength: 12, maxLength: 13 }, // +58 4XX XXX XXXX
  "51": { name: "Peru", minLength: 11, maxLength: 12 }, // +51 9XX XXX XXX
  "52": { name: "México", minLength: 12, maxLength: 13 }, // +52 1 XX XXXX XXXX
  "53": { name: "Cuba", minLength: 10, maxLength: 11 }, // +53 5XXX XXXX
  "591": { name: "Bolívia", minLength: 11, maxLength: 12 }, // +591 7XXX XXXX
  "593": { name: "Equador", minLength: 12, maxLength: 13 }, // +593 9X XXX XXXX
  "595": { name: "Paraguai", minLength: 12, maxLength: 13 }, // +595 9XX XXX XXX
  "598": { name: "Uruguai", minLength: 11, maxLength: 12 }, // +598 9X XXX XXX
  "506": { name: "Costa Rica", minLength: 11, maxLength: 12 }, // +506 XXXX XXXX
  "507": { name: "Panamá", minLength: 11, maxLength: 12 }, // +507 XXXX XXXX
};

/**
 * Normaliza um número de telefone da América Latina para o formato internacional
 */
export function normalizePhoneNumber(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Remove todos os caracteres não numéricos
  let digits = phone.replace(/\D/g, "");

  // Se já começa com +, remove para processar
  if (phone.startsWith("+")) {
    digits = phone.substring(1).replace(/\D/g, "");
  }

  // Detectar código do país
  let countryCode = "";
  let countryInfo = null;

  // Tentar códigos de 3 dígitos primeiro (Bolivia, Equador, Paraguai, Uruguai)
  for (const code of ["591", "593", "595", "598", "506", "507"]) {
    if (digits.startsWith(code)) {
      countryCode = code;
      countryInfo = LATIN_AMERICA_CODES[code];
      break;
    }
  }

  // Se não encontrou, tentar códigos de 2 dígitos
  if (!countryCode) {
    for (const code of ["54", "55", "56", "57", "58", "51", "52", "53"]) {
      if (digits.startsWith(code)) {
        countryCode = code;
        countryInfo = LATIN_AMERICA_CODES[code];
        break;
      }
    }
  }

  // Se não tem código de país, assumir Brasil
  if (!countryCode) {
    if (digits.length >= 10 && digits.length <= 11) {
      countryCode = "55";
      countryInfo = LATIN_AMERICA_CODES["55"];
      digits = countryCode + digits;
    } else {
      return {
        normalized: phone,
        valid: false,
        error: "Formato de número não reconhecido"
      };
    }
  }

  // Adicionar + se não tiver
  const normalized = digits.startsWith("+") ? digits : "+" + digits;

  // Validar comprimento
  if (countryInfo) {
    const phoneLength = normalized.length;
    if (phoneLength < countryInfo.minLength || phoneLength > countryInfo.maxLength) {
      return {
        normalized,
        valid: false,
        error: `Número ${countryInfo.name} deve ter entre ${countryInfo.minLength} e ${countryInfo.maxLength} dígitos`
      };
    }
  }

  // Validação específica do Brasil
  if (countryCode === "55") {
    return validateBrazilianPhone(normalized);
  }

  // Para outros países, apenas validar se tem o código correto
  return {
    normalized,
    valid: true
  };
}

/**
 * Valida se um número normalizado está no formato correto
 */
function validateBrazilianPhone(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Deve começar com +55
  if (!phone.startsWith("+55")) {
    return {
      normalized: phone,
      valid: false,
      error: "Número deve ser brasileiro (+55)"
    };
  }

  // Extrair DDD (posições 3-4)
  const ddd = phone.substring(3, 5);
  const dddNum = parseInt(ddd);

  // DDD deve estar entre 11 e 99
  if (dddNum < 11 || dddNum > 99) {
    return {
      normalized: phone,
      valid: false,
      error: `DDD inválido: ${ddd}`
    };
  }

  // Extrair nono dígito (posição 5)
  const ninthDigit = phone.substring(5, 6);

  // Para celular, o nono dígito deve ser 9
  // Números fixos (8) não podem receber WhatsApp, então rejeitamos
  if (ninthDigit !== "9") {
    return {
      normalized: phone,
      valid: false,
      error: "Apenas números de celular (com 9 inicial) são aceitos"
    };
  }

  // Validar comprimento total: +55 (3) + DD (2) + 9XXXXXXXX (9) = 14 caracteres
  if (phone.length !== 14) {
    return {
      normalized: phone,
      valid: false,
      error: `Comprimento inválido: ${phone.length} caracteres`
    };
  }

  return {
    normalized: phone,
    valid: true
  };
}

/**
 * Parseia uma lista de contatos (CSV ou texto colado)
 */
export function parseContactList(text: string): ParsedContact[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const contacts: ParsedContact[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tentar separar por vírgula ou ponto-e-vírgula
    const parts = trimmed.split(/[,;]/);
    const rawPhone = parts[0]?.trim() || "";
    const name = parts[1]?.trim();

    // Normalizar e validar
    const result = normalizePhoneNumber(rawPhone);

    contacts.push({
      phone: result.normalized,
      name: name || undefined,
      valid: result.valid,
      error: result.error
    });
  }

  return contacts;
}

/**
 * Verifica quais números têm WhatsApp ativo via Evolution API
 */
export async function validateWhatsAppNumbers(
  contacts: ParsedContact[],
  instanceId: string,
  evolutionConfig: { api_url: string; api_key: string; instance_name: string }
): Promise<{ validated: ParsedContact[]; rejected: ParsedContact[] }> {
  const validated: ParsedContact[] = [];
  const rejected: ParsedContact[] = [];

  // Filtrar apenas contatos válidos
  const validContacts = contacts.filter(c => c.valid);

  if (validContacts.length === 0) {
    return { validated: [], rejected: contacts };
  }

  try {
    // Montar URL da API
    const apiUrl = evolutionConfig.api_url.replace(/\/+$/, "");
    const endpoint = `${apiUrl}/chat/whatsappNumbers/${evolutionConfig.instance_name}`;

    // Preparar lista de números
    const numbers = validContacts.map(c => c.phone);

    // Fazer requisição para Evolution API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionConfig.api_key
      },
      body: JSON.stringify({ numbers })
    });

    if (!response.ok) {
      throw new Error(`Evolution API retornou erro: ${response.status}`);
    }

    const result = await response.json();

    // Processar resposta
    // Formato esperado: [{ number: "+5521999999999", exists: true, jid: "..." }, ...]
    const responseArray = Array.isArray(result) ? result : [];

    for (const contact of validContacts) {
      const apiResult = responseArray.find(r => r.number === contact.phone);
      
      if (apiResult && apiResult.exists === true) {
        validated.push(contact);
      } else {
        rejected.push({
          ...contact,
          valid: false,
          error: "Número não tem WhatsApp ativo"
        });
      }
    }

    // Adicionar contatos inválidos à lista de rejeitados
    const invalidContacts = contacts.filter(c => !c.valid);
    rejected.push(...invalidContacts);

  } catch (error: any) {
    console.error("Erro ao validar WhatsApp via Evolution API:", error);
    throw new Error(`Falha na validação WhatsApp: ${error.message}`);
  }

  return { validated, rejected };
}

/**
 * Fluxo completo de validação
 */
export async function validateContactsComplete(
  text: string,
  instanceId: string,
  evolutionConfig: { api_url: string; api_key: string; instance_name: string }
): Promise<ValidationResult> {
  // 1. Parsear e normalizar
  const parsed = parseContactList(text);

  // 2. Separar válidos e inválidos
  const validContacts = parsed.filter(c => c.valid);
  const invalidContacts = parsed.filter(c => !c.valid);

  // 3. Validar WhatsApp para contatos válidos
  let whatsappValidated: ParsedContact[] = [];
  let whatsappRejected: ParsedContact[] = [];

  if (validContacts.length > 0) {
    const result = await validateWhatsAppNumbers(validContacts, instanceId, evolutionConfig);
    whatsappValidated = result.validated;
    whatsappRejected = result.rejected.filter(c => c.valid); // Apenas os que eram válidos mas foram rejeitados pelo WhatsApp
  }

  return {
    validContacts,
    invalidContacts,
    whatsappValidated,
    whatsappRejected: [...invalidContacts, ...whatsappRejected]
  };
}
