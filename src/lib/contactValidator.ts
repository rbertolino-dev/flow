/**
 * Utilitários para validação e normalização de contatos
 * Valida números brasileiros e verifica WhatsApp via Evolution API
 */

export interface ParsedContact {
  phone: string;
  name?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
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
 * Normaliza um número de telefone brasileiro para o formato 55DDXXXXXXXXX
 * MENOS RESTRITIVO - aceita números de 10 e 11 dígitos
 */
export function normalizePhoneNumber(phone: string): { normalized: string; valid: boolean; error?: string } {
  // Remove todos os caracteres não numéricos
  let digits = phone.replace(/\D/g, "");

  // Se já começa com 55 e tem tamanho correto
  if (digits.startsWith("55")) {
    if (digits.length === 12 || digits.length === 13) {
      // Formato válido: 55 + DDD (2) + número (8 ou 9)
      return { normalized: digits, valid: true };
    }
  }

  // Se tem 10 dígitos: DDD + 8 números (formato antigo ou fixo)
  if (digits.length === 10) {
    digits = "55" + digits;
    return { normalized: digits, valid: true };
  }

  // Se tem 11 dígitos: DDD + 9 + 8 números (celular)
  if (digits.length === 11) {
    digits = "55" + digits;
    return { normalized: digits, valid: true };
  }

  // Se tem 8 ou 9 dígitos (sem DDD) - não podemos processar
  if (digits.length === 8 || digits.length === 9) {
    return {
      normalized: phone,
      valid: false,
      error: "Número precisa incluir o DDD"
    };
  }

  // Fora do padrão aceitável
  if (digits.length < 10 || digits.length > 13) {
    return {
      normalized: phone,
      valid: false,
      error: `Número com ${digits.length} dígitos - deve ter entre 10 e 13`
    };
  }

  return {
    normalized: digits,
    valid: true
  };
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
 * Melhorado para aceitar espaço como separador e detectar automaticamente campos
 */
export function parseContactList(text: string, useLatamValidator: boolean = false): ParsedContact[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const contacts: ParsedContact[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detectar separador: vírgula, ponto-e-vírgula, tab ou espaço múltiplo
    let parts: string[] = [];
    
    // Primeiro tentar separadores comuns (vírgula, ponto-e-vírgula, tab)
    if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('\t')) {
      parts = trimmed.split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, ''));
    } else {
      // Se não tem separadores comuns, usar espaço múltiplo ou espaço simples
      // Espaço múltiplo (2 ou mais) = separador de colunas de planilha
      if (trimmed.match(/\s{2,}/)) {
        parts = trimmed.split(/\s{2,}/).map(p => p.trim());
      } else {
        // Espaço simples: tentar detectar campos inteligentemente
        // Dividir por espaço e depois agrupar palavras que não são telefone
        const spaceParts = trimmed.split(/\s+/);
        parts = [];
        
        let currentField = '';
        for (let i = 0; i < spaceParts.length; i++) {
          const part = spaceParts[i];
          const phoneRegex = /[\d\s\(\)\-\+]{10,}/;
          
          // Se é telefone, finalizar campo anterior e adicionar telefone
          if (phoneRegex.test(part)) {
            if (currentField) {
              parts.push(currentField.trim());
              currentField = '';
            }
            parts.push(part);
          } else {
            // É texto, adicionar ao campo atual
            if (currentField) {
              currentField += ' ' + part;
            } else {
              currentField = part;
            }
          }
        }
        if (currentField) {
          parts.push(currentField.trim());
        }
      }
    }

    // Detectar telefone, nome e empresa automaticamente
    let rawPhone = '';
    let name = '';
    let empresa = '';
    
    // Regex para detectar telefone (10+ dígitos)
    const phoneRegex = /[\d\s\(\)\-\+]{10,}/;
    
    // Encontrar telefone em qualquer parte
    let phoneIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (phoneRegex.test(parts[i])) {
        rawPhone = parts[i];
        phoneIndex = i;
        break;
      }
    }
    
    if (!rawPhone) {
      // Se não encontrou telefone, assumir primeiro campo é telefone
      rawPhone = parts[0] || '';
      phoneIndex = 0;
    }
    
    // Preencher nome e empresa baseado na posição do telefone
    if (phoneIndex === 0) {
      // Telefone primeiro: nome e empresa vêm depois
      name = parts[1] || '';
      empresa = parts[2] || parts[3] || '';
    } else if (phoneIndex === 1) {
      // Telefone segundo: nome primeiro, empresa depois
      name = parts[0] || '';
      empresa = parts[2] || parts[3] || '';
    } else if (phoneIndex > 1) {
      // Telefone depois: nome e empresa antes
      name = parts[0] || '';
      empresa = parts.slice(1, phoneIndex).join(' ') || parts[phoneIndex + 1] || '';
    } else {
      // Fallback: primeiro campo é nome, segundo é telefone
      name = parts[0] || '';
      rawPhone = parts[1] || rawPhone;
      empresa = parts[2] || parts[3] || '';
    }
    
    // Detectar email em qualquer parte
    let email = '';
    for (const part of parts) {
      if (part.includes('@') && part.includes('.')) {
        email = part;
        break;
      }
    }
    
    // Se encontrou email e não tem empresa definida, pode ser que email esteja no lugar da empresa
    if (email && !empresa && phoneIndex > 0) {
      // Verificar se há campo entre telefone e email que pode ser empresa
      const emailIndex = parts.findIndex(p => p.includes('@'));
      if (emailIndex > phoneIndex) {
        empresa = parts.slice(phoneIndex + 1, emailIndex).join(' ') || '';
      }
    }

    // Normalizar e validar telefone baseado no tipo selecionado
    const result = useLatamValidator 
      ? normalizeLatamPhoneNumber(rawPhone)
      : normalizePhoneNumber(rawPhone);

    contacts.push({
      phone: result.normalized,
      name: name || undefined,
      empresa: empresa || undefined,
      nome_empresa: empresa || undefined, // Se tem empresa, usar também como nome_empresa
      email: email || undefined,
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
    console.log(`📞 Números a validar:`, uniqueNumbers);

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
        console.error(`❌ Erro na validação (lote ${chunkIndex + 1}):`, resp.status, preview.slice(0, 500));
        
        // Se o método não estiver disponível, considerar todos válidos
        if (preview.includes("Method not available") || preview.includes("method not available")) {
          console.warn("⚠️ Validação WhatsApp indisponível neste canal Evolution - todos números serão aceitos");
          return { validated: validContacts, rejected: contacts.filter(c => !c.valid) };
        }
        
        // Detectar erro 428 (Precondition Required) com "Connection Closed" - instância desconectada
        if (resp.status === 428 || resp.status === 400) {
          let errorMessage = preview;
          try {
            const errorData = JSON.parse(preview);
            errorMessage = errorData?.output?.payload?.message || errorData?.message || preview;
          } catch {
            // Se não conseguir parsear, usar preview como está
          }
          
          if (errorMessage?.includes("Connection Closed") || errorMessage?.includes("connection closed") || 
              errorMessage?.includes("Precondition Required") || preview.includes("Connection Closed")) {
            throw new Error(
              `A instância WhatsApp "${evolutionConfig.instance_name}" está DESCONECTADA. ` +
              `Conecte a instância antes de validar contatos. ` +
              `Status: ${resp.status} - ${errorMessage || preview.slice(0, 100)}`
            );
          }
        }
        
        throw new Error(`Evolution API retornou erro: ${resp.status}${preview ? ` - ${preview.slice(0,120)}` : ''}`);
      }

      const data = await resp.json().catch(() => null);
      console.log(`📥 Resposta do lote ${chunkIndex + 1}:`, JSON.stringify(data, null, 2));
      
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
          
          // Também mapear pelos últimos dígitos para matching flexível
          const last8 = normalizedApiNumber.slice(-8);
          const last9 = normalizedApiNumber.slice(-9);
          const last10 = normalizedApiNumber.slice(-10);
          const last11 = normalizedApiNumber.slice(-11);
          
          if (!apiResultsMap.has(last8)) apiResultsMap.set(last8, result);
          if (!apiResultsMap.has(last9)) apiResultsMap.set(last9, result);
          if (!apiResultsMap.has(last10)) apiResultsMap.set(last10, result);
          if (!apiResultsMap.has(last11)) apiResultsMap.set(last11, result);
        }
      }
    }

    console.log(`🗺️ Mapa de resultados criado com ${apiResultsMap.size} entradas`);

    // Processar cada contato e verificar na resposta da API
    let validatedCount = 0;
    let rejectedCount = 0;

    for (const contact of validContacts) {
      const normalized = normalizePhoneForComparison(contact.phone);
      
      // Tentar encontrar resultado por várias estratégias
      let apiResult = apiResultsMap.get(normalized);
      
      if (!apiResult) {
        // Tentar pelos últimos dígitos
        apiResult = apiResultsMap.get(normalized.slice(-11)) ||
                   apiResultsMap.get(normalized.slice(-10)) ||
                   apiResultsMap.get(normalized.slice(-9)) ||
                   apiResultsMap.get(normalized.slice(-8));
      }

      if (apiResult) {
        // PRIORIZAR o campo "exists" - é o indicador real de WhatsApp ativo
        // O campo "jid" sempre vem preenchido, mesmo quando não tem WhatsApp
        let hasWhatsApp = false;
        
        // Se exists está explicitamente definido, usar esse valor
        if (apiResult.exists !== undefined && apiResult.exists !== null) {
          hasWhatsApp = apiResult.exists === true || apiResult.exists === "true";
        } else {
          // Fallback apenas se exists não estiver definido
          hasWhatsApp = apiResult.hasWhatsApp === true || apiResult.status === "valid";
        }

        console.log(`🔍 ${contact.phone}: exists=${apiResult.exists}, jid=${apiResult.jid}, hasWhatsApp=${hasWhatsApp}`);

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
    // Contatos rejeitados pelo WhatsApp = validContacts - whatsappValidated
    // NÃO usar result.rejected.filter(c => c.valid) pois valid é alterado para false nos rejeitados
    whatsappRejected = result.rejected.filter(r => 
      validContacts.some(v => v.phone === r.phone)
    );
  }

  return {
    validContacts,
    invalidContacts,
    whatsappValidated,
    whatsappRejected: [...invalidContacts, ...whatsappRejected]
  };
}