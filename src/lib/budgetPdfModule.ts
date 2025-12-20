// Gerador de PDF para módulo de orçamentos (100% do zero)
// Títulos estáticos em português (sem interferência)

import { jsPDF } from 'jspdf';
import { BudgetPdfOptions, Budget } from '@/types/budget-module';

// ==========================================
// CONSTANTES DE TÍTULOS (Estáticos - sem interferência)
// ==========================================
const TITLE_HEADER = 'ORCAMENTO';
const TITLE_CLIENT_DATA = 'DADOS DO CLIENTE';
const TITLE_PRODUCTS = 'PRODUTOS';
const TITLE_SERVICES = 'SERVIÇOS';
const TITLE_PAYMENT = 'FORMA DE PAGAMENTO';
const TITLE_DELIVERY = 'INFORMACOES DE ENTREGA';
const TITLE_OBSERVATIONS = 'OBSERVACOES';
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
// FUNÇÃO PRINCIPAL DE GERAÇÃO DE PDF
// ==========================================
export async function generateBudgetPDF(options: BudgetPdfOptions): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  // Configurações de página
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);
  const lineHeight = 5;
  let yPosition = 0;

  const budget = options.budget;
  const headerColor = options.headerColor || budget.header_color || '#3b82f6';
  const logoUrl = options.logoUrl || budget.logo_url;

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
    
    // Logo (se fornecido)
    if (logoUrl) {
      loadImage(logoUrl).then((logoData) => {
        if (logoData) {
          try {
            doc.addImage(logoData, 'PNG', margin, 2, 20, 8);
          } catch (e) {
            console.warn('Erro ao adicionar logo:', e);
          }
        }
      });
    }
    
    // Título estático
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(TITLE_HEADER, pageWidth / 2, barHeight / 2 + 2, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    yPosition = barHeight + 5;
  };

  // Função para adicionar nova página se necessário
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      drawPageHeader();
      return true;
    }
    return false;
  };

  // Desenhar header na primeira página
  drawPageHeader();

  // Número do orçamento
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Numero: ${budget.budget_number}`, margin, yPosition);
  yPosition += lineHeight * 1.5;

  // Data de validade
  if (budget.expires_at) {
    const expiresDate = new Date(budget.expires_at).toLocaleDateString('pt-BR');
    doc.text(`Validade: ${expiresDate}`, margin, yPosition);
    yPosition += lineHeight * 1.5;
  }

  // Linha separadora
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 1.5;

  // DADOS DO CLIENTE
  checkNewPage(lineHeight * 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(TITLE_CLIENT_DATA, margin, yPosition);
  yPosition += lineHeight * 1.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const client = budget.client_data || budget.lead;
  if (client) {
    doc.text(`Nome: ${client.name || ''}`, margin, yPosition);
    yPosition += lineHeight;
    if (client.phone) {
      doc.text(`Telefone: ${client.phone}`, margin, yPosition);
      yPosition += lineHeight;
    }
    if (client.email) {
      doc.text(`Email: ${client.email}`, margin, yPosition);
      yPosition += lineHeight;
    }
    if (client.company) {
      doc.text(`Empresa: ${client.company}`, margin, yPosition);
      yPosition += lineHeight;
    }
  }
  yPosition += lineHeight * 0.5;

  // Linha separadora
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 1.5;

  // PRODUTOS
  if (budget.products && budget.products.length > 0) {
    checkNewPage(lineHeight * 4);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(TITLE_PRODUCTS, margin, yPosition);
    yPosition += lineHeight * 1.2;

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
    doc.text('Descricao', margin + 2, yPosition);
    doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
    doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
    doc.text('Subtotal', margin + 160, yPosition, { align: 'right' });
    yPosition += lineHeight * 1.5;
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 0.8;
    doc.setFont('helvetica', 'normal');

    // Linhas de produtos (zebra)
    let rowIndex = 0;
    for (const product of budget.products) {
      if (checkNewPage(lineHeight * 3)) {
        // Recriar cabeçalho se nova página
        const headerRgbNew = hexToRgb(headerColor);
        const lightRNew = Math.min(255, headerRgbNew[0] + 220);
        const lightGNew = Math.min(255, headerRgbNew[1] + 220);
        const lightBNew = Math.min(255, headerRgbNew[2] + 220);
        doc.setFillColor(lightRNew, lightGNew, lightBNew);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Descricao', margin + 2, yPosition);
        doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
        doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
        doc.text('Subtotal', margin + 160, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.5;
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight * 0.8;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      // Zebra striping
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.2, 'F');
      }

      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      
      const descLines = doc.splitTextToSize(product.name || '', 85);
      doc.text(descLines[0], margin + 2, yPosition);
      doc.text(formatCurrency(product.price || 0), margin + 100, yPosition, { align: 'right' });
      doc.text(product.quantity.toString(), margin + 130, yPosition, { align: 'right' });
      doc.text(formatCurrency(product.subtotal || 0), margin + 160, yPosition, { align: 'right' });
      
      yPosition += lineHeight * 1.2;

      // Descrição adicional (se houver)
      for (let i = 1; i < descLines.length; i++) {
        if (checkNewPage(lineHeight)) {
          yPosition += lineHeight * 0.5;
        }
        doc.text(descLines[i], margin + 2, yPosition);
        yPosition += lineHeight;
      }

      rowIndex++;
    }
    yPosition += lineHeight * 0.5;
  }

  // SERVIÇOS
  if (budget.services && budget.services.length > 0) {
    checkNewPage(lineHeight * 4);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(TITLE_SERVICES, margin, yPosition);
    yPosition += lineHeight * 1.2;

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
    doc.text('Descricao', margin + 2, yPosition);
    doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
    doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
    doc.text('Subtotal', margin + 160, yPosition, { align: 'right' });
    yPosition += lineHeight * 1.5;
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 0.8;
    doc.setFont('helvetica', 'normal');

    // Linhas de serviços (zebra)
    let rowIndex = 0;
    for (const service of budget.services) {
      if (checkNewPage(lineHeight * 3)) {
        // Recriar cabeçalho se nova página
        const headerRgbNew = hexToRgb(headerColor);
        const lightRNew = Math.min(255, headerRgbNew[0] + 220);
        const lightGNew = Math.min(255, headerRgbNew[1] + 220);
        const lightBNew = Math.min(255, headerRgbNew[2] + 220);
        doc.setFillColor(lightRNew, lightGNew, lightBNew);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Descricao', margin + 2, yPosition);
        doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
        doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
        doc.text('Subtotal', margin + 160, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.5;
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight * 0.8;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      // Zebra striping
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, maxWidth, lineHeight * 1.2, 'F');
      }

      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      
      const descLines = doc.splitTextToSize(service.name || '', 85);
      doc.text(descLines[0], margin + 2, yPosition);
      doc.text(formatCurrency(service.price || 0), margin + 100, yPosition, { align: 'right' });
      doc.text(service.quantity.toString(), margin + 130, yPosition, { align: 'right' });
      doc.text(formatCurrency(service.subtotal || 0), margin + 160, yPosition, { align: 'right' });
      
      yPosition += lineHeight * 1.2;

      // Descrição adicional (se houver)
      for (let i = 1; i < descLines.length; i++) {
        if (checkNewPage(lineHeight)) {
          yPosition += lineHeight * 0.5;
        }
        doc.text(descLines[i], margin + 2, yPosition);
        yPosition += lineHeight;
      }

      rowIndex++;
    }
    yPosition += lineHeight * 0.5;
  }

  // TOTAIS
  checkNewPage(lineHeight * 6);
  doc.setLineWidth(0.5);
  doc.setDrawColor(150, 150, 150);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 1.5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${TITLE_SUBTOTAL} ${formatCurrency(budget.subtotal_products + budget.subtotal_services)}`, margin + 100, yPosition, { align: 'right' });
  yPosition += lineHeight;

  if (budget.additions !== 0) {
    const additionsLabel = budget.additions > 0 ? TITLE_ADDITION : TITLE_DISCOUNT;
    doc.text(`${additionsLabel} ${formatCurrency(Math.abs(budget.additions))}`, margin + 100, yPosition, { align: 'right' });
    yPosition += lineHeight;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${TITLE_TOTAL} ${formatCurrency(budget.total)}`, margin + 100, yPosition, { align: 'right' });
  yPosition += lineHeight * 1.5;

  // FORMA DE PAGAMENTO
  if (budget.payment_methods && budget.payment_methods.length > 0) {
    checkNewPage(lineHeight * 3);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(TITLE_PAYMENT, margin, yPosition);
    yPosition += lineHeight * 1.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(budget.payment_methods.join(', '), margin, yPosition);
    yPosition += lineHeight * 1.5;
  }

  // INFORMAÇÕES DE ENTREGA
  if (budget.delivery_date || budget.delivery_location) {
    checkNewPage(lineHeight * 4);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(TITLE_DELIVERY, margin, yPosition);
    yPosition += lineHeight * 1.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (budget.delivery_date) {
      const deliveryDate = new Date(budget.delivery_date).toLocaleDateString('pt-BR');
      doc.text(`Data: ${deliveryDate}`, margin, yPosition);
      yPosition += lineHeight;
    }
    if (budget.delivery_location) {
      const locationLines = doc.splitTextToSize(`Local: ${budget.delivery_location}`, maxWidth);
      doc.text(locationLines, margin, yPosition);
      yPosition += lineHeight * locationLines.length;
    }
    yPosition += lineHeight * 0.5;
  }

  // OBSERVAÇÕES
  if (budget.observations) {
    checkNewPage(lineHeight * 4);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(TITLE_OBSERVATIONS, margin, yPosition);
    yPosition += lineHeight * 1.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(budget.observations, maxWidth);
    doc.text(obsLines, margin, yPosition);
    yPosition += lineHeight * obsLines.length;
  }

  // Rodapé com numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Gerar blob
  return doc.output('blob');
}

