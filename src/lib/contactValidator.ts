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
 * Normaliza um número de telefone brasileiro para o formato +55DD9XXXXXXXX
 */
export function normalizePhoneNumber(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Remove todos os caracteres não numéricos
  let digits = phone.replace(/\D/g, "");

  // Regras de normalização
  if (digits.startsWith("55") && digits.length === 13) {
    // Já está no formato correto: 55DD9XXXXXXXX
    digits = "+" + digits;
  } else if (digits.startsWith("55") && digits.length === 11) {
    // Caso especial: DDD 55 (Rio Grande do Sul)
    digits = "+55" + digits;
  } else if (digits.length === 11) {
    // Apenas DDD + número: DD9XXXXXXXX
    digits = "+55" + digits;
  } else if (digits.length === 10) {
    // Número fixo: DD8XXXXXXXX ou DD9XXXXXXX (sem o 9 inicial)
    digits = "+55" + digits;
  } else if (digits.length < 10 || digits.length > 13) {
    // Fora do padrão aceitável
    return {
      normalized: phone,
      valid: false,
      error: "Número deve ter entre 10 e 13 dígitos"
    };
  } else {
    // Outros formatos não suportados
    return {
      normalized: phone,
      valid: false,
      error: "Formato de número não reconhecido"
    };
  }

  // Validação final
  return validateBrazilianPhone(digits);
}

/**
 * Normaliza um número de telefone LATAM para o formato internacional
 * Aceita códigos de países da América Latina: +54, +57, +52, +51, +56, +58, +593, +595, etc.
 */
export function normalizeLatamPhoneNumber(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Remove todos os caracteres não numéricos
  let digits = phone.replace(/\D/g, "");

  // Se já começa com + e tem código de país, aceitar
  if (phone.startsWith("+") && digits.length >= 10) {
    return validateLatamPhone("+" + digits);
  }

  // Se começa com código de país sem +
  const countryCode = digits.substring(0, 2);
  const latamCodes = ["54", "57", "52", "51", "56", "58", "59"]; // Argentina, Colômbia, México, Peru, Chile, Venezuela, Paraguai/Uruguai/Equador
  
  if (latamCodes.some(code => countryCode.startsWith(code))) {
    digits = "+" + digits;
    return validateLatamPhone(digits);
  }

  // Formato não reconhecido
  return {
    normalized: phone,
    valid: false,
    error: "Número LATAM deve incluir código do país (ex: +54, +57, +52, etc.)"
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
 * Valida se um número LATAM normalizado está no formato correto
 */
function validateLatamPhone(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Deve começar com +
  if (!phone.startsWith("+")) {
    return {
      normalized: phone,
      valid: false,
      error: "Número deve começar com código do país (+XX)"
    };
  }

  // Códigos de países LATAM válidos
  const validCountryCodes = [
    "54",  // Argentina
    "57",  // Colômbia
    "52",  // México
    "51",  // Peru
    "56",  // Chile
    "58",  // Venezuela
    "593", // Equador
    "595", // Paraguai
    "598", // Uruguai
    "591", // Bolívia
    "507", // Panamá
    "506", // Costa Rica
    "502", // Guatemala
    "503", // El Salvador
    "504", // Honduras
    "505"  // Nicarágua
  ];

  // Extrair código do país (2 ou 3 dígitos)
  const digits = phone.substring(1);
  const hasValidCode = validCountryCodes.some(code => digits.startsWith(code));

  if (!hasValidCode) {
    return {
      normalized: phone,
      valid: false,
      error: "Código de país LATAM não reconhecido"
    };
  }

  // Validar comprimento mínimo (geralmente 10+ dígitos com código)
  if (phone.length < 11) {
    return {
      normalized: phone,
      valid: false,
      error: "Número muito curto para LATAM"
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
export function parseContactList(text: string, useLatamValidator: boolean = false): ParsedContact[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const contacts: ParsedContact[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tentar separar por vírgula ou ponto-e-vírgula
    const parts = trimmed.split(/[,;]/);
    const rawPhone = parts[0]?.trim() || "";
    const name = parts[1]?.trim();

    // Normalizar e validar baseado no tipo selecionado
    const result = useLatamValidator 
      ? normalizeLatamPhoneNumber(rawPhone)
      : normalizePhoneNumber(rawPhone);

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
 * Normaliza um número de telefone para comparação (remove +, espaços, etc)
 * Retorna apenas os dígitos numéricos
 */
function normalizePhoneForComparison(phone: string): string {
  if (!phone) return "";
  // Remove todos os caracteres não numéricos
  return phone.replace(/\D/g, "");
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

    // Criar mapa de números normalizados para contatos originais
    // Isso garante que possamos mapear corretamente a resposta da API
    const phoneToContactMap = new Map<string, ParsedContact>();
    const normalizedNumbers: string[] = [];

    for (const contact of validContacts) {
      // Normalizar número (remover + e manter apenas dígitos)
      const normalized = normalizePhoneForComparison(contact.phone);
      if (normalized && !phoneToContactMap.has(normalized)) {
        phoneToContactMap.set(normalized, contact);
        normalizedNumbers.push(normalized);
      }
    }

    // Remover duplicados mantendo ordem
    const uniqueNumbers = Array.from(new Set(normalizedNumbers));

    console.log(`📞 Validando ${uniqueNumbers.length} números únicos via Evolution API`);

    // A Evolution API costuma limitar o tamanho do lote. Enviar em batches para evitar 400.
    const chunkSize = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueNumbers.length; i += chunkSize) {
      chunks.push(uniqueNumbers.slice(i, i + chunkSize));
    }

    const aggregated: any[] = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`📦 Processando lote ${chunkIndex + 1}/${chunks.length} com ${chunk.length} números`);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "apikey": evolutionConfig.api_key
        },
        body: JSON.stringify({ numbers: chunk })
      });

      if (!resp.ok) {
        const preview = await resp.text().catch(() => "");
        // Se o método não estiver disponível, considerar todos válidos
        if (preview.includes("Method not available") || preview.includes("method not available")) {
          console.warn("⚠️ Validação WhatsApp indisponível neste canal Evolution - todos números serão aceitos");
          return { validated: validContacts, rejected: contacts.filter(c => !c.valid) };
        }
        console.error(`❌ Erro na validação (lote ${chunkIndex + 1}):`, resp.status, preview.slice(0, 200));
        throw new Error(`Evolution API retornou erro: ${resp.status}${preview ? ` - ${preview.slice(0,120)}` : ''}`);
      }

      const data = await resp.json().catch(() => null);
      
      if (data && Array.isArray(data)) {
        console.log(`✅ Lote ${chunkIndex + 1} retornou ${data.length} resultados`);
        aggregated.push(...data);
      } else if (data && typeof data === 'object') {
        // Algumas versões da API podem retornar objeto com array dentro
        const dataArray = data.data || data.results || data.numbers || [];
        if (Array.isArray(dataArray)) {
          console.log(`✅ Lote ${chunkIndex + 1} retornou ${dataArray.length} resultados (formato objeto)`);
          aggregated.push(...dataArray);
        } else {
          console.warn(`⚠️ Formato de resposta inesperado no lote ${chunkIndex + 1}:`, typeof data);
        }
      } else {
        console.warn(`⚠️ Resposta vazia ou inválida no lote ${chunkIndex + 1}`);
      }
    }

    console.log(`📊 Total de ${aggregated.length} resultados recebidos da API`);

    // Criar mapa de resultados da API normalizados
    const apiResultsMap = new Map<string, any>();
    for (const result of aggregated) {
      if (result && result.number) {
        const normalizedApiNumber = normalizePhoneForComparison(result.number);
        if (normalizedApiNumber) {
          // Se já existe, manter o que tem exists: true (priorizar validação positiva)
          if (!apiResultsMap.has(normalizedApiNumber) || result.exists === true) {
            apiResultsMap.set(normalizedApiNumber, result);
          }
        }
      }
    }

    // Processar cada contato e verificar na resposta da API
    let validatedCount = 0;
    let rejectedCount = 0;

    for (const contact of validContacts) {
      const normalized = normalizePhoneForComparison(contact.phone);
      const apiResult = apiResultsMap.get(normalized);

      if (apiResult) {
        // Verificar múltiplas formas de indicar que existe WhatsApp
        const hasWhatsApp = 
          apiResult.exists === true || 
          apiResult.exists === "true" ||
          apiResult.hasWhatsApp === true ||
          (apiResult.jid && apiResult.jid.length > 0) ||
          apiResult.status === "valid";

        if (hasWhatsApp) {
          validated.push(contact);
          validatedCount++;
        } else {
          rejected.push({
            ...contact,
            valid: false,
            error: "Número não tem WhatsApp ativo"
          });
          rejectedCount++;
        }
      } else {
        // Número não encontrado na resposta da API
        // Isso pode acontecer se a API não retornou o número ou se houve problema na correspondência
        console.warn(`⚠️ Número não encontrado na resposta da API: ${contact.phone} (normalizado: ${normalized})`);
        rejected.push({
          ...contact,
          valid: false,
          error: "Número não retornado pela API ou sem WhatsApp"
        });
        rejectedCount++;
      }
    }

    console.log(`✅ Validação concluída: ${validatedCount} válidos, ${rejectedCount} rejeitados`);

    // Adicionar contatos inválidos à lista de rejeitados
    const invalidContacts = contacts.filter(c => !c.valid);
    rejected.push(...invalidContacts);

  } catch (error: any) {
    console.error("❌ Erro ao validar WhatsApp via Evolution API:", error);
    // Se a validação falhar por qualquer motivo relacionado ao método indisponível, aceitar todos
    if (error.message?.includes("Method not available") || error.message?.includes("method not available")) {
      console.warn("⚠️ Validação WhatsApp indisponível - aceitando todos os números válidos");
      return { validated: validContacts, rejected: contacts.filter(c => !c.valid) };
    }
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
  evolutionConfig: { api_url: string; api_key: string; instance_name: string },
  useLatamValidator: boolean = false
): Promise<ValidationResult> {
  // 1. Parsear e normalizar
  const parsed = parseContactList(text, useLatamValidator);

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
