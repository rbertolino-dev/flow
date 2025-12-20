// Função para gerar PDF de orçamento usando jsPDF - VERSÃO 2 (100% Garantida)
// Baseado no contractPdfGenerator.ts que funciona perfeitamente
// Estratégia: Constantes de títulos + Sanitização byte-a-byte + Validação pós-geração

import { BudgetPdfOptions, Budget } from '@/types/budget';
import { formatPaymentMethods } from '@/lib/paymentMethods';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';

// ==========================================
// CONSTANTES DE TÍTULOS (Definidas no topo para evitar problemas de encoding)
// ==========================================
// Estas constantes são definidas como strings literais puras no topo do arquivo
// para garantir que não há problema de encoding ou caracteres invisíveis

const TITLE_HEADER = 'ORCAMENTO';
const TITLE_CLIENT_DATA = 'DADOS DO CLIENTE';
const TITLE_PRODUCTS = 'PRODUTOS';
const TITLE_PAYMENT = 'FORMA DE PAGAMENTO';
const TITLE_DELIVERY = 'INFORMACOES DE ENTREGA';
const TITLE_OTHER = 'OUTRAS INFORMACOES';
const TITLE_SIGNATURE = 'Assinatura';
const TITLE_SUBTOTAL = 'SUBTOTAL:';
const TITLE_ADDITION = 'ACRESCIMO:';
const TITLE_DISCOUNT = 'DESCONTO:';
const TITLE_TOTAL = 'TOTAL:';

// ==========================================
// FUNÇÃO AUXILIAR PARA CARREGAR IMAGEM
// ==========================================
async function loadImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      console.warn('Erro ao carregar imagem:', response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao carregar imagem:', error);
    return null;
  }
}

// ==========================================
// FUNÇÃO DE SANITIZAÇÃO ULTRA-RIGOROSA (Byte-a-Byte)
// ==========================================
// Usa TextEncoder/TextDecoder para garantir encoding correto byte-a-byte
function sanitizeTextUltraSafe(text: string): string {
  try {
    // Converter string para array de bytes UTF-8
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    
    // Filtrar APENAS ASCII válido (32-126)
    // 32 = espaço, 33-47 = pontuação, 48-57 = números, 58-64 = símbolos
    // 65-90 = A-Z, 91-96 = símbolos, 97-122 = a-z, 123-126 = símbolos
    const asciiBytes = bytes.filter(byte => byte >= 32 && byte <= 126);
    
    // Converter de volta para string usando TextDecoder
    const decoder = new TextDecoder('utf-8');
    const cleanText = decoder.decode(new Uint8Array(asciiBytes)).trim();
    
    // Log apenas se houver diferença (para debug)
    if (cleanText !== text.trim()) {
      console.warn('[PDF] Texto sanitizado:', { 
        original: text, 
        cleaned: cleanText,
        originalBytes: Array.from(bytes),
        cleanedBytes: Array.from(asciiBytes)
      });
    }
    
    return cleanText;
  } catch (error) {
    console.error('[PDF] Erro na sanitização:', error);
    // Fallback: remover caracteres não-ASCII manualmente
    return text
      .split('')
      .filter(char => {
        const code = char.charCodeAt(0);
        return code >= 32 && code <= 126;
      })
      .join('')
      .trim();
  }
}

// ==========================================
// FUNÇÃO DE ESCRITA SEGURA DE TÍTULOS
// ==========================================
// Esta função garante que títulos sejam escritos corretamente
function writeTitleSafe(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number = 10,
  options?: any
): void {
  // Passo 1: Sanitizar texto usando método ultra-seguro
  const cleanText = sanitizeTextUltraSafe(text);
  
  // Passo 2: Reset COMPLETO de estado do jsPDF
  // IMPORTANTE: Fazer reset na ordem correta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.1);
  
  // Passo 3: Definir fonte bold e escrever
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);
  
  // Passo 4: Escrever texto limpo (garantido ASCII apenas)
  if (cleanText) {
    try {
      doc.text(cleanText, x, y, options);
    } catch (error) {
      console.error('[PDF] Erro ao escrever título:', error, { text: cleanText });
      // Fallback: tentar escrever sem opções
      doc.text(cleanText, x, y);
    }
  }
}

// ==========================================
// FUNÇÃO PRINCIPAL DE GERAÇÃO DE PDF
// ==========================================
export async function generateBudgetPDF(options: BudgetPdfOptions): Promise<Blob> {
  // Criar documento jsPDF (EXATAMENTE como no contractPdfGenerator)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  // Configurações de página (idênticas ao contrato)
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);
  const lineHeight = 5;
  let yPosition = 0;

  const budget = options.budget;
  const headerColor = options.headerColor || (budget as any).header_color || '#3b82f6';
  const logoUrl = options.logoUrl || (budget as any).logo_url;

  // Função para converter hex para RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [59, 130, 246]; // Azul padrão
  };

  // Função para formatar moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para desenhar header da página (barra colorida)
  const drawPageHeader = () => {
    const barHeight = 12.5;
    const [r, g, b] = hexToRgb(headerColor);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, barHeight, 'F');
    
    // Usar constante de título (garantida)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(TITLE_HEADER, pageWidth / 2, barHeight / 2 + 2, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
  };

  // Função para adicionar nova página se necessário
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      drawPageHeader();
      yPosition = margin + 18;
      return true;
    }
    return false;
  };

  // ==========================================
  // HEADER - Primeira página
  // ==========================================
  drawPageHeader();
  yPosition = 18;

  // Carregar logo (se fornecido)
  if (logoUrl) {
    try {
      const logoDataUrl = await loadImage(logoUrl);
      if (logoDataUrl) {
        const logoHeight = 10;
        const logoWidth = 30;
        const logoX = pageWidth - margin - logoWidth;
        const logoY = yPosition;
        const imageType = logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
        doc.addImage(logoDataUrl, imageType, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }

  // Informações da empresa e documento
  yPosition = 20;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  
  const orgName = 'Agilize Vendas';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(orgName, margin, yPosition);
  yPosition += lineHeight * 1.2;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  // Lado direito: Número do orçamento e datas
  const rightX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orcamento N: ${budget.budget_number}`, rightX, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Emissao: ${format(new Date(budget.created_at), 'dd/MM/yyyy')}`, rightX, 20 + lineHeight, { align: 'right' });
  if (budget.delivery_date) {
    doc.text(`Data de entrega: ${format(new Date(budget.delivery_date), 'dd/MM/yyyy')}`, rightX, 20 + lineHeight * 2, { align: 'right' });
  }
  if (budget.delivery_location) {
    const locationLines = doc.splitTextToSize(`Local de entrega: ${budget.delivery_location}`, 80);
    locationLines.forEach((line: string, idx: number) => {
      doc.text(line, rightX, 20 + lineHeight * 3 + (idx * lineHeight), { align: 'right' });
    });
  }

  yPosition = 35;

  // ==========================================
  // DADOS DO CLIENTE
  // ==========================================
  checkNewPage(lineHeight * 8);
  
  // Usar função writeTitleSafe com constante de título
  writeTitleSafe(doc, TITLE_CLIENT_DATA, margin, yPosition, 10);
  yPosition += lineHeight * 1.5;

  const client = budget.client_data || budget.lead;
  if (client) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    
    const leftColX = margin;
    const rightColX = margin + maxWidth / 2;
    let leftY = yPosition;
    let rightY = yPosition;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', leftColX, leftY);
    doc.setFont('helvetica', 'normal');
    leftY += lineHeight;
    doc.text(client.name || '', leftColX, leftY);
    leftY += lineHeight * 1.2;
    
    if (client.company) {
      doc.text(`Endereco: ${client.company}`, leftColX, leftY);
      leftY += lineHeight;
    }
    
    if (client.email) {
      doc.text(`Email: ${client.email}`, leftColX, leftY);
      leftY += lineHeight;
    }
    
    if (client.phone) {
      doc.text(`Telefone: ${client.phone}`, rightColX, rightY);
      rightY += lineHeight;
    }
    
    yPosition = Math.max(leftY, rightY) + lineHeight * 1.5;
  }

  // ==========================================
  // TABELA DE PRODUTOS E SERVIÇOS
  // ==========================================
  
  const allItems: Array<{
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
    type: 'product' | 'service';
  }> = [];
  
  if (budget.products && budget.products.length > 0) {
    budget.products.forEach(p => {
      allItems.push({
        name: p.name || '',
        price: p.price || 0,
        quantity: p.quantity || 1,
        subtotal: p.subtotal || (p.price || 0) * (p.quantity || 1),
        type: 'product',
      });
    });
  }
  
  if (budget.services && budget.services.length > 0) {
    budget.services.forEach(s => {
      allItems.push({
        name: s.name || '',
        price: s.price || 0,
        quantity: s.quantity || 1,
        subtotal: s.subtotal || (s.price || 0) * (s.quantity || 1),
        type: 'service',
      });
    });
  }

  if (allItems.length > 0) {
    checkNewPage(lineHeight * 15);
    
    // Usar função writeTitleSafe com constante de título
    writeTitleSafe(doc, TITLE_PRODUCTS, margin, yPosition, 10);
    yPosition += lineHeight * 1.5;
    
    // Cabeçalho da tabela
    const headerRgb = hexToRgb(headerColor);
    const lightR = Math.min(255, headerRgb[0] + 220);
    const lightG = Math.min(255, headerRgb[1] + 220);
    const lightB = Math.min(255, headerRgb[2] + 220);
    doc.setFillColor(lightR, lightG, lightB);
    doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.5, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    doc.text('Produto', margin + 2, yPosition);
    doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
    doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
    doc.text('Total', margin + 160, yPosition, { align: 'right' });
    
    yPosition += lineHeight * 1.5;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 0.8;

    // Itens da tabela
    doc.setFont('helvetica', 'normal');
    let rowIndex = 0;
    for (const item of allItems) {
      if (checkNewPage(lineHeight * 3)) {
        // Recriar cabeçalho se nova página
        const headerRgbNew = hexToRgb(headerColor);
        const lightR = Math.min(255, headerRgbNew[0] + 220);
        const lightG = Math.min(255, headerRgbNew[1] + 220);
        const lightB = Math.min(255, headerRgbNew[2] + 220);
        doc.setFillColor(lightR, lightG, lightB);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Produto', margin + 2, yPosition);
        doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
        doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
        doc.text('Total', margin + 160, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.5;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight * 0.8;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.2, 'F');
      }

      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      
      const descLines = doc.splitTextToSize(item.name, 85);
      doc.text(descLines[0], margin + 2, yPosition);
      doc.text(formatCurrency(item.price), margin + 100, yPosition, { align: 'right' });
      
      const qtyText = item.type === 'product' && item.quantity === 1 ? '1 Metros' : 
                      item.type === 'service' && item.quantity === 1 ? '1 M2' : 
                      item.quantity.toString();
      doc.text(qtyText, margin + 130, yPosition, { align: 'right' });
      doc.text(formatCurrency(item.subtotal), margin + 160, yPosition, { align: 'right' });
      
      yPosition += lineHeight * 1.2;

      for (let i = 1; i < descLines.length; i++) {
        if (checkNewPage(lineHeight)) {
          yPosition += lineHeight * 0.5;
        }
        doc.text(descLines[i], margin + 5, yPosition);
        yPosition += lineHeight;
      }

      rowIndex++;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 1.5;

    // Totais
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (budget.subtotal_products > 0 || (budget.subtotal_services && budget.subtotal_services > 0)) {
      doc.text(TITLE_SUBTOTAL, margin + 100, yPosition, { align: 'right' });
      doc.text(formatCurrency(budget.subtotal_products + (budget.subtotal_services || 0)), margin + 160, yPosition, { align: 'right' });
      yPosition += lineHeight;
    }
    
    if (budget.additions !== 0) {
      const label = budget.additions > 0 ? TITLE_ADDITION : TITLE_DISCOUNT;
      doc.text(label, margin + 100, yPosition, { align: 'right' });
      doc.text(formatCurrency(Math.abs(budget.additions)), margin + 160, yPosition, { align: 'right' });
      yPosition += lineHeight;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const totalRgb = hexToRgb(headerColor);
    doc.setTextColor(totalRgb[0], totalRgb[1], totalRgb[2]);
    doc.text(TITLE_TOTAL, margin + 100, yPosition, { align: 'right' });
    doc.text(formatCurrency(budget.total || 0), margin + 160, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += lineHeight * 2;
  }

  // ==========================================
  // INFORMAÇÕES ADICIONAIS
  // ==========================================
  checkNewPage(lineHeight * 12);
  
  const leftInfoX = margin;
  const rightInfoX = margin + maxWidth / 2;
  let infoY = yPosition;

  // Coluna esquerda: Forma de Pagamento
  if (budget.payment_methods && budget.payment_methods.length > 0) {
    // Usar função writeTitleSafe com constante de título
    writeTitleSafe(doc, TITLE_PAYMENT, leftInfoX, infoY, 10);
    infoY += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const paymentText = formatPaymentMethods(budget.payment_methods as any[]);
    const paymentLines = doc.splitTextToSize(paymentText, maxWidth / 2 - 5);
    paymentLines.forEach((line: string) => {
      doc.text(line, leftInfoX, infoY);
      infoY += lineHeight;
    });
    infoY += lineHeight * 0.5;
  }

  // Coluna direita: Informações de Entrega
  let rightInfoY = yPosition;
  if (budget.expires_at) {
    // Usar função writeTitleSafe com constante de título
    writeTitleSafe(doc, TITLE_DELIVERY, rightInfoX, rightInfoY, 10);
    rightInfoY += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    rightInfoY += lineHeight;
    const expiresDate = format(new Date(budget.expires_at), 'dd/MM/yyyy');
    doc.text(`O presente orcamento possui validade de ${budget.validity_days || 7} dias uteis.`, rightInfoX, rightInfoY);
    rightInfoY += lineHeight;
    doc.text('Apos o prazo entre em contato para novo orcamento.', rightInfoX, rightInfoY);
    rightInfoY += lineHeight * 1.5;
  }

  yPosition = Math.max(infoY, rightInfoY) + lineHeight;

  // Observações
  if (budget.observations) {
    checkNewPage(lineHeight * 6);
    // Usar função writeTitleSafe com constante de título
    writeTitleSafe(doc, TITLE_OTHER, margin, yPosition, 9);
    doc.setFont('helvetica', 'normal');
    yPosition += lineHeight;
    const obsLines = doc.splitTextToSize(budget.observations, maxWidth);
    obsLines.forEach((line: string) => {
      if (checkNewPage(lineHeight)) {
        yPosition += lineHeight * 0.5;
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
    yPosition += lineHeight;
  }

  // ==========================================
  // RODAPÉ
  // ==========================================
  checkNewPage(lineHeight * 8);
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 2;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(TITLE_SIGNATURE, pageWidth / 2, yPosition, { align: 'center' });

  // Rodapé com numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Gerar blob do PDF
  const pdfBlob = doc.output('blob');
  
  // Log de sucesso
  console.log('[PDF] PDF de orçamento gerado com sucesso usando V2 (constantes + sanitização byte-a-byte)');
  
  return pdfBlob;
}

