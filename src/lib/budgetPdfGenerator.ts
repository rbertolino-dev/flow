// Função para gerar PDF de orçamento usando jsPDF
// Baseado no padrão do contractPdfGenerator.ts que funciona perfeitamente
import { BudgetPdfOptions, Budget } from '@/types/budget';
import { formatPaymentMethods } from '@/lib/paymentMethods';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';

// Função auxiliar para carregar imagem (mesma do contractPdfGenerator)
async function loadImage(url: string): Promise<string | null> {
  try {
    // Se for imagem do Google Cloud Storage, tratar CORS especial
    if (url.includes('storage.googleapis.com')) {
      try {
        // Tentar com CORS primeiro
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache',
        });
        
        if (!response.ok) {
          console.warn('⚠️ Imagem do Google Cloud Storage não acessível (HTTP):', response.statusText);
          return null;
        }
        
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          console.warn('⚠️ Imagem do Google Cloud Storage vazia ou inválida. Pulando...');
          return null;
        }
        
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => {
            console.warn('⚠️ Erro ao converter imagem do Google Storage para base64. Pulando...');
            resolve(null);
          };
          reader.readAsDataURL(blob);
        });
      } catch (corsError: any) {
        // Erro de CORS - apenas logar e continuar sem a imagem
        console.warn('⚠️ Erro de CORS ao carregar imagem do Google Cloud Storage. A imagem será pulada:', url);
        return null;
      }
    }
    
    // Para outras URLs, tentar normalmente
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      console.warn('⚠️ Erro ao carregar imagem (HTTP):', response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      console.warn('⚠️ Imagem vazia ou inválida. Pulando...');
      return null;
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn('⚠️ Erro ao converter imagem para base64. Pulando...');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    // Tratar todos os tipos de erro (CORS, network, etc.)
    if (error.message?.includes('CORS') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('ERR_FAILED') ||
        error.name === 'TypeError') {
      console.warn('⚠️ Erro ao carregar imagem (CORS/Network). A imagem será pulada:', url);
      return null;
    }
    console.warn('⚠️ Erro ao carregar imagem. A imagem será pulada:', error.message || error);
    return null;
  }
}

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
  const headerColor = options.headerColor || (budget as any).header_color || '#3b82f6';
  const logoUrl = options.logoUrl || (budget as any).logo_url || options.organizationData?.logo_url;
  const organizationData = options.organizationData;

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

  // Camada 1: Função de Sanitização Rigorosa - Garante APENAS ASCII 32-126
  const ensureAsciiTitle = (text: string): string => {
    // Converter para array de códigos Unicode
    const codes = Array.from(text).map(char => char.charCodeAt(0));
    
    // Filtrar APENAS ASCII válido (32-126): espaço, letras A-Z, a-z, números 0-9, pontuação básica
    const validCodes = codes.filter(code => code >= 32 && code <= 126);
    
    // Converter de volta para string e remover espaços extras
    const cleanText = String.fromCharCode(...validCodes).trim();
    
    // Log para debug (remover em produção se necessário)
    if (cleanText !== text) {
      console.warn('Texto sanitizado:', { original: text, cleaned: cleanText });
    }
    
    return cleanText;
  };

  // Camada 2: Função Helper para Escrever Títulos com Reset Completo de Estado
  const writeTitle = (text: string, x: number, y: number, fontSize: number = 10, options?: any) => {
    // Camada 1: Sanitizar texto para garantir apenas ASCII
    const cleanText = ensureAsciiTitle(text);
    
    // Camada 2: Reset COMPLETO de estado do jsPDF antes de escrever
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.1);
    
    // Camada 3: Escrever com fonte bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    
    // Escrever texto limpo (garantido ASCII apenas)
    if (cleanText) {
      doc.text(cleanText, x, y, options);
    }
  };

  // Função para desenhar header da página (barra colorida)
  const drawPageHeader = () => {
    const barHeight = 12.5;
    const [r, g, b] = hexToRgb(headerColor);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, barHeight, 'F');
    
    // EXATAMENTE como no contractPdfGenerator - string literal direta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('ORCAMENTO', pageWidth / 2, barHeight / 2 + 2, { align: 'center' });
    
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

  // ==========================================
  // CABEÇALHO COM LOGO E DADOS DA ORGANIZAÇÃO
  // ==========================================
  const headerStartY = 20;
  let currentY = headerStartY;
  const logoSize = 20; // Tamanho da logo
  const logoMargin = 5; // Espaçamento após logo
  const leftColumnX = margin;
  const rightColumnX = pageWidth - margin;
  
  // Carregar e posicionar logo à esquerda
  let logoLoaded = false;
  let logoHeight = logoSize; // Altura padrão
  if (logoUrl) {
    try {
      const logoDataUrl = await loadImage(logoUrl);
      if (logoDataUrl) {
        // Usar dimensões fixas para logo (ajustar proporção se necessário)
        const logoWidth = logoSize;
        logoHeight = logoSize; // Altura igual à largura (quadrado) ou ajustar conforme necessário
        
        const imageType = logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
        doc.addImage(logoDataUrl, imageType, leftColumnX, currentY, logoWidth, logoHeight);
        logoLoaded = true;
      }
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }

  // Dados da organização (ao lado da logo ou abaixo se não houver logo)
  const orgDataStartX = logoLoaded ? leftColumnX + logoSize + logoMargin : leftColumnX;
  const orgDataStartY = currentY;
  let orgDataY = orgDataStartY;
  
  // Nome da organização
  const orgName = organizationData?.name || 'Agilize Vendas';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(orgName, orgDataStartX, orgDataY);
  orgDataY += lineHeight * 1.2;
  
  // Perfil da empresa (MEI, ME, LTDA, etc.) e CNPJ se disponível
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  
  if (organizationData?.company_profile) {
    doc.text(organizationData.company_profile, orgDataStartX, orgDataY);
    orgDataY += lineHeight;
  }
  
  // Endereço da organização
  if (organizationData?.address) {
    const addressLines = doc.splitTextToSize(organizationData.address, maxWidth - (orgDataStartX - margin));
    addressLines.forEach((line: string) => {
      doc.text(line, orgDataStartX, orgDataY);
      orgDataY += lineHeight;
    });
  } else if (organizationData?.city || organizationData?.state) {
    const locationParts = [];
    if (organizationData.city) locationParts.push(organizationData.city);
    if (organizationData.state) locationParts.push(organizationData.state);
    if (locationParts.length > 0) {
      doc.text(locationParts.join(' - '), orgDataStartX, orgDataY);
      orgDataY += lineHeight;
    }
  }
  
  // Ajustar posição Y baseado na altura do cabeçalho
  const headerHeight = Math.max(logoHeight, orgDataY - orgDataStartY);
  currentY = headerStartY + headerHeight + lineHeight * 1.5;
  
  // Lado direito: Número do orçamento e datas
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`Orcamento N: ${budget.budget_number}`, rightColumnX, headerStartY, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  let rightY = headerStartY + lineHeight;
  doc.text(`Emissao: ${format(new Date(budget.created_at), 'dd/MM/yyyy')}`, rightColumnX, rightY, { align: 'right' });
  rightY += lineHeight;
  
  if (budget.delivery_date) {
    doc.text(`Data de entrega: ${format(new Date(budget.delivery_date), 'dd/MM/yyyy')}`, rightColumnX, rightY, { align: 'right' });
    rightY += lineHeight;
  }
  if (budget.delivery_location) {
    const locationLines = doc.splitTextToSize(`Local: ${budget.delivery_location}`, 80);
    locationLines.forEach((line: string, idx: number) => {
      doc.text(line, rightColumnX, rightY + (idx * lineHeight), { align: 'right' });
    });
  }

  // Linha separadora após cabeçalho
  currentY += lineHeight * 0.5;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += lineHeight;
  
  yPosition = currentY;

  // ==========================================
  // DADOS DO CLIENTE
  // ==========================================
  checkNewPage(lineHeight * 8);
  
  // Usar função writeTitle que garante sanitização e reset completo de estado
  writeTitle('DADOS DO CLIENTE', margin, yPosition, 10);
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
    
    // Usar função writeTitle que garante sanitização e reset completo de estado
    writeTitle('PRODUTOS', margin, yPosition, 10);
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
      doc.text('SUBTOTAL:', margin + 100, yPosition, { align: 'right' });
      doc.text(formatCurrency(budget.subtotal_products + (budget.subtotal_services || 0)), margin + 160, yPosition, { align: 'right' });
      yPosition += lineHeight;
    }
    
    if (budget.additions !== 0) {
      const label = budget.additions > 0 ? 'ACRESCIMO:' : 'DESCONTO:';
      doc.text(label, margin + 100, yPosition, { align: 'right' });
      doc.text(formatCurrency(Math.abs(budget.additions)), margin + 160, yPosition, { align: 'right' });
      yPosition += lineHeight;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const totalRgb = hexToRgb(headerColor);
    doc.setTextColor(totalRgb[0], totalRgb[1], totalRgb[2]);
    doc.text('TOTAL:', margin + 100, yPosition, { align: 'right' });
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
    // Usar função writeTitle que garante sanitização e reset completo de estado
    writeTitle('FORMA DE PAGAMENTO', leftInfoX, infoY, 10);
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
    // Usar função writeTitle que garante sanitização e reset completo de estado
    writeTitle('INFORMACOES DE ENTREGA', rightInfoX, rightInfoY, 10);
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
    // Usar função writeTitle que garante sanitização e reset completo de estado
    writeTitle('OUTRAS INFORMACOES', margin, yPosition, 9);
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
  doc.text('Assinatura', pageWidth / 2, yPosition, { align: 'center' });

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
  return pdfBlob;
}
