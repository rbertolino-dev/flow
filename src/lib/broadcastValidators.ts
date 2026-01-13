/**
 * Validações Robustas para Módulo de Broadcast
 * 
 * Fornece validações centralizadas com mensagens de erro claras
 */

import { broadcastLogger } from './broadcastLogger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

/**
 * Valida URL de imagem
 */
export async function validateImageUrl(imageUrl: string | null | undefined): Promise<ValidationResult> {
  if (!imageUrl) {
    return { valid: true }; // null/undefined é válido (imagem opcional)
  }

  try {
    // Verificar formato de URL
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(imageUrl)) {
      return {
        valid: false,
        error: 'URL de imagem inválida. Deve começar com http:// ou https://',
        details: { imageUrl },
      };
    }

    // Verificar se imagem existe e é acessível (HEAD request)
    try {
      const response = await fetch(imageUrl, { method: 'HEAD', mode: 'no-cors' });
      // No-cors não retorna status, mas se não lançar erro, provavelmente existe
      broadcastLogger.debug('IMAGE_VALIDATION', `URL de imagem acessível: ${imageUrl}`);
    } catch (error) {
      // Em no-cors, erros podem ser ignorados, mas logamos
      broadcastLogger.warn('IMAGE_VALIDATION', `Não foi possível verificar acessibilidade da imagem`, { imageUrl, error });
    }

    // Verificar extensão/tipo
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const hasValidExtension = imageExtensions.some(ext => 
      imageUrl.toLowerCase().includes(ext)
    );

    if (!hasValidExtension) {
      broadcastLogger.warn('IMAGE_VALIDATION', `URL pode não ser uma imagem válida`, { imageUrl });
    }

    return { valid: true };
  } catch (error: any) {
    broadcastLogger.error('IMAGE_VALIDATION', 'Erro ao validar URL de imagem', { imageUrl }, error);
    return {
      valid: false,
      error: `Erro ao validar URL: ${error.message}`,
      details: { imageUrl, error: error.message },
    };
  }
}

/**
 * Valida arquivo de imagem antes do upload
 */
export function validateImageFile(file: File): ValidationResult {
  // Validar tipo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Use: ${allowedTypes.join(', ')}`,
      details: { fileName: file.name, fileType: file.type },
    };
  }

  // Validar tamanho (5MB máximo)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: 5MB`,
      details: { fileName: file.name, fileSize: file.size, maxSize },
    };
  }

  broadcastLogger.debug('IMAGE_VALIDATION', `Arquivo de imagem válido`, {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  return { valid: true };
}

/**
 * Valida dados de contato para substituição de tags
 */
export function validateContactData(contact: {
  phone: string;
  name?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  custom_fields?: Record<string, string>;
}): ValidationResult {
  // Validar telefone
  if (!contact.phone || contact.phone.trim() === '') {
    return {
      valid: false,
      error: 'Telefone é obrigatório',
      details: { contact },
    };
  }

  // Validar formato de telefone (deve começar com +)
  if (!contact.phone.startsWith('+')) {
    return {
      valid: false,
      error: 'Telefone deve estar no formato internacional (ex: +5521999999999)',
      details: { phone: contact.phone },
    };
  }

  // Validar email se fornecido
  if (contact.email && contact.email.trim() !== '') {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contact.email)) {
      return {
        valid: false,
        error: 'Email inválido',
        details: { email: contact.email },
      };
    }
  }

  broadcastLogger.debug('CONTACT_VALIDATION', `Dados de contato válidos`, {
    phone: contact.phone,
    hasName: !!contact.name,
    hasEmpresa: !!contact.empresa,
    hasNomeEmpresa: !!contact.nome_empresa,
    hasEmail: !!contact.email,
    hasCustomFields: !!contact.custom_fields && Object.keys(contact.custom_fields).length > 0,
  });

  return { valid: true };
}

/**
 * Valida template de mensagem
 */
export function validateMessageTemplate(template: string): ValidationResult {
  if (!template || template.trim() === '') {
    return {
      valid: false,
      error: 'Template de mensagem não pode estar vazio',
    };
  }

  // Extrair tags do template
  const tags = (template.match(/\{(\w+)\}/gi) || []).map(m => m.replace(/[{}]/g, ''));
  
  broadcastLogger.debug('TEMPLATE_VALIDATION', `Template validado`, {
    templateLength: template.length,
    tagsFound: tags,
    tagCount: tags.length,
  });

  return { valid: true, details: { tags } };
}

/**
 * Valida que template tem dados necessários para substituir tags
 */
export function validateTemplateAgainstContactData(
  template: string,
  contactData: Record<string, string | undefined>
): ValidationResult {
  const templateTags = (template.match(/\{(\w+)\}/gi) || []).map(m => 
    m.replace(/[{}]/g, '').toLowerCase()
  );
  
  const missingTags: string[] = [];
  const availableTags: string[] = [];

  templateTags.forEach(tag => {
    const normalizedTag = tag.toLowerCase();
    if (contactData[normalizedTag] === undefined || contactData[normalizedTag] === '') {
      missingTags.push(tag);
    } else {
      availableTags.push(tag);
    }
  });

  if (missingTags.length > 0) {
    broadcastLogger.warn('TEMPLATE_VALIDATION', `Tags faltando dados no contato`, {
      missingTags,
      availableTags,
      template: template.substring(0, 100),
    });
  }

  return {
    valid: missingTags.length === 0,
    error: missingTags.length > 0 ? `Tags sem dados: ${missingTags.join(', ')}` : undefined,
    details: { missingTags, availableTags, templateTags },
  };
}

/**
 * Valida resposta da Evolution API
 */
export function validateEvolutionAPIResponse(response: Response, data: any): ValidationResult {
  if (!response.ok) {
    return {
      valid: false,
      error: `Evolution API retornou erro: ${response.status} ${response.statusText}`,
      details: { status: response.status, statusText: response.statusText, data },
    };
  }

  // Verificar se resposta tem estrutura esperada
  if (data && typeof data === 'object') {
    // Resposta válida
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Resposta da Evolution API em formato inesperado',
    details: { data },
  };
}
