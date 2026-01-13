/**
 * Sistema de Logging Centralizado para Módulo de Broadcast
 * 
 * Fornece logging estruturado com níveis, timestamps e exportação de logs
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
}

class BroadcastLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Limitar memória
  private enabled = true;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, category: string, message: string, data?: any, error?: Error): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    // Adicionar ao array de logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remover logs mais antigos
    }

    // Log no console com formatação
    const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
    const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                          level === LogLevel.WARN ? 'warn' : 
                          level === LogLevel.DEBUG ? 'debug' : 'log';
    
    if (error) {
      console[consoleMethod](prefix, message, data, error);
    } else if (data) {
      console[consoleMethod](prefix, message, data);
    } else {
      console[consoleMethod](prefix, message);
    }
  }

  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, category, message, data, error);
  }

  // Métodos específicos para cada funcionalidade
  logTemplateSave(action: 'create' | 'update', templateId: string | null, data: {
    name: string;
    image_url: string | null;
    hasImage: boolean;
    success: boolean;
    error?: any;
  }): void {
    if (data.success) {
      this.info('TEMPLATE_SAVE', `${action === 'create' ? 'Criado' : 'Atualizado'} template "${data.name}"`, {
        templateId,
        image_url: data.image_url,
        hasImage: data.hasImage,
      });
    } else {
      this.error('TEMPLATE_SAVE', `Falha ao ${action === 'create' ? 'criar' : 'atualizar'} template "${data.name}"`, {
        templateId,
        image_url: data.image_url,
        error: data.error,
      });
    }
  }

  logTagReplacement(phone: string, template: string, contactData: any, result: string): void {
    const tagsFound = (template.match(/\{(\w+)\}/gi) || []).map(m => m.replace(/[{}]/g, ''));
    const tagsReplaced = tagsFound.filter(tag => {
      const normalized = tag.toLowerCase();
      return contactData[normalized] !== undefined && contactData[normalized] !== '';
    });

    this.debug('TAG_REPLACEMENT', `Substituição de tags para ${phone}`, {
      originalTemplate: template.substring(0, 100),
      tagsFound,
      tagsReplaced,
      contactData: Object.keys(contactData).reduce((acc, key) => {
        if (contactData[key]) acc[key] = contactData[key];
        return acc;
      }, {} as any),
      result: result.substring(0, 100),
    });
  }

  logImageUpload(action: 'upload' | 'remove' | 'validate', data: {
    fileName?: string;
    fileSize?: number;
    imageUrl?: string | null;
    success: boolean;
    error?: any;
  }): void {
    if (data.success) {
      this.info('IMAGE_UPLOAD', `Imagem ${action === 'upload' ? 'enviada' : action === 'remove' ? 'removida' : 'validada'}`, {
        fileName: data.fileName,
        fileSize: data.fileSize,
        imageUrl: data.imageUrl,
      });
    } else {
      this.error('IMAGE_UPLOAD', `Falha ao ${action} imagem`, {
        fileName: data.fileName,
        error: data.error,
      });
    }
  }

  logEvolutionAPI(action: 'sendText' | 'sendMedia', data: {
    phone: string;
    instance: string;
    success: boolean;
    imageUrl?: string;
    caption?: string;
    message?: string;
    error?: any;
    responseStatus?: number;
  }): void {
    if (data.success) {
      this.info('EVOLUTION_API', `${action} para ${data.phone} via ${data.instance}`, {
        action,
        phone: data.phone,
        instance: data.instance,
        hasImage: !!data.imageUrl,
        captionLength: data.caption?.length || 0,
        messageLength: data.message?.length || 0,
      });
    } else {
      this.error('EVOLUTION_API', `Falha ao ${action} para ${data.phone}`, {
        action,
        phone: data.phone,
        instance: data.instance,
        imageUrl: data.imageUrl,
        error: data.error,
        responseStatus: data.responseStatus,
      });
    }
  }

  logContactView(action: 'view' | 'load', data: {
    contactId?: string;
    leadId?: string;
    phone: string;
    success: boolean;
    hasLeadData: boolean;
    error?: any;
  }): void {
    if (data.success) {
      this.info('CONTACT_VIEW', `${action === 'view' ? 'Visualizado' : 'Carregado'} contato ${data.phone}`, {
        contactId: data.contactId,
        leadId: data.leadId,
        hasLeadData: data.hasLeadData,
      });
    } else {
      this.error('CONTACT_VIEW', `Falha ao ${action === 'view' ? 'visualizar' : 'carregar'} contato ${data.phone}`, {
        contactId: data.contactId,
        leadId: data.leadId,
        error: data.error,
      });
    }
  }

  // Exportar logs para análise
  exportLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Limpar logs
  clearLogs(): void {
    this.logs = [];
  }

  // Obter logs por categoria
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  // Obter logs por nível
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Habilitar/desabilitar logging
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Instância singleton
export const broadcastLogger = new BroadcastLogger();

// Exportar para uso global (debug)
if (typeof window !== 'undefined') {
  (window as any).broadcastLogger = broadcastLogger;
}
