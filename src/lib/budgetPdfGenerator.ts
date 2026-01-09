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
  // Baseado no modelo da imagem laranja
  // ==========================================
  const headerStartY = 20;
  let currentY = headerStartY;
  const logoSize = 25; // Tamanho da logo (aumentado)
  const leftColumnX = margin;
  const rightColumnX = pageWidth - margin;
  const logoRightX = rightColumnX - logoSize; // Logo no topo direito
  
  // Carregar e posicionar logo no topo direito (ao lado da data)
  let logoLoaded = false;
  let logoHeight = logoSize;
  if (logoUrl) {
    try {
      const logoDataUrl = await loadImage(logoUrl);
      if (logoDataUrl) {
        const logoWidth = logoSize;
        logoHeight = logoSize;
        const imageType = logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
        // Logo no topo direito, alinhada com a data de emissão
        doc.addImage(logoDataUrl, imageType, logoRightX, headerStartY, logoWidth, logoHeight);
        logoLoaded = true;
      }
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }

  // Dados da organização no topo esquerdo (SEMPRE mostrar, mesmo vazios)
  const orgDataStartX = leftColumnX;
  let orgDataY = headerStartY;
  
  // Nome da organização (negrito, maior) - SEMPRE mostrar
  const orgName = organizationData?.name || '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(orgName, orgDataStartX, orgDataY);
  orgDataY += lineHeight * 1.1;
  
  // CNPJ - SEMPRE mostrar (mesmo vazio)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`CNPJ: ${organizationData?.cnpj || ''}`, orgDataStartX, orgDataY);
  orgDataY += lineHeight * 0.9;
  
  // Endereço da organização - SEMPRE mostrar (mesmo vazio)
  if (organizationData?.address) {
    const addressLines = doc.splitTextToSize(organizationData.address, 90);
    addressLines.forEach((line: string) => {
      doc.text(`Endereco: ${line}`, orgDataStartX, orgDataY);
      orgDataY += lineHeight * 0.9;
    });
  } else {
    doc.text(`Endereco: `, orgDataStartX, orgDataY);
    orgDataY += lineHeight * 0.9;
  }
  
  // Telefone - SEMPRE mostrar (mesmo vazio)
  doc.text(`Telefone: ${organizationData?.phone || ''}`, orgDataStartX, orgDataY);
  orgDataY += lineHeight * 0.9;
  
  // Email - SEMPRE mostrar (mesmo vazio)
  doc.text(`Email: ${organizationData?.contact_email || ''}`, orgDataStartX, orgDataY);
  orgDataY += lineHeight * 0.9;
  
  // Lado direito: Logo (já posicionada) e Data de emissão
  let headerRightY = headerStartY;
  if (logoLoaded) {
    // Data ao lado da logo (um pouco à esquerda)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Emissao: ${format(new Date(budget.created_at), 'dd/MM/yyyy')}`, logoRightX - 5, headerRightY + logoHeight / 2, { align: 'right' });
  } else {
    // Se não houver logo, data no topo direito
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Emissao: ${format(new Date(budget.created_at), 'dd/MM/yyyy')}`, rightColumnX, headerRightY, { align: 'right' });
    headerRightY += lineHeight;
  }
  
  // Número do orçamento abaixo da data (ou logo)
  headerRightY = headerStartY + (logoLoaded ? logoHeight + lineHeight * 0.5 : lineHeight * 1.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`Orcamento N°: ${budget.budget_number}`, rightColumnX, headerRightY, { align: 'right' });
  headerRightY += lineHeight;
  
  // Data de entrega (se houver)
  if (budget.delivery_date) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Data de entrega: ${format(new Date(budget.delivery_date), 'dd/MM/yyyy')}`, rightColumnX, headerRightY, { align: 'right' });
    headerRightY += lineHeight;
  }

  // Linha separadora após cabeçalho (como na imagem laranja)
  currentY = Math.max(orgDataY, headerRightY) + lineHeight * 0.5;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += lineHeight * 0.8;
  
  yPosition = currentY;

  // ==========================================
  // DADOS DO CLIENTE
  // ==========================================
  checkNewPage(lineHeight * 8);
  
  // Linha separadora antes de "DADOS DO CLIENTE" (como na imagem laranja)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 0.8;
  
  // Usar função writeTitle que garante sanitização e reset completo de estado
  writeTitle('DADOS DO CLIENTE', margin, yPosition, 10);
  yPosition += lineHeight * 1.1;

  const client = budget.client_data || budget.lead;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  
  const leftColX = margin;
  const rightColX = margin + maxWidth / 2;
  let leftY = yPosition;
  let rightY = yPosition;
  
  // Mostrar campos (CPF e CEP apenas se houver dados)
  
  // Lado esquerdo
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', leftColX, leftY);
  doc.setFont('helvetica', 'normal');
  leftY += lineHeight * 0.9;
  doc.text(client?.name || '', leftColX, leftY);
  leftY += lineHeight * 1.0;
  
  // Endereço (sempre mostrar)
  doc.text(`Endereco: ${client?.company || ''}`, leftColX, leftY);
  leftY += lineHeight * 0.9;
  
  // Bairro (sempre mostrar, mesmo vazio)
  doc.text(`Bairro: `, leftColX, leftY);
  leftY += lineHeight * 0.9;
  
  // Email (sempre mostrar)
  doc.text(`Email: ${client?.email || ''}`, leftColX, leftY);
  leftY += lineHeight * 0.9;
  
  // Lado direito
  // CPF (apenas se houver dados)
  const cpfCnpj = (client as any)?.cpf_cnpj;
  if (cpfCnpj) {
    doc.text(`CPF: ${cpfCnpj}`, rightColX, rightY);
    rightY += lineHeight * 0.9;
  }
  
  // CEP (apenas se houver dados - verificar se existe campo CEP)
  const cep = (client as any)?.cep || (client as any)?.zip_code;
  if (cep) {
    doc.text(`CEP: ${cep}`, rightColX, rightY);
    rightY += lineHeight * 0.9;
  }
  
  // Cidade (sempre mostrar, mesmo vazio)
  doc.text(`Cidade: `, rightColX, rightY);
  rightY += lineHeight * 0.9;
  
  // Telefone (sempre mostrar)
  doc.text(`Telefone: ${client?.phone || ''}`, rightColX, rightY);
  rightY += lineHeight * 0.9;
  
  yPosition = Math.max(leftY, rightY) + lineHeight * 1.0;

  // Linha separadora antes de "PRODUTOS" (como na imagem laranja)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 0.8;

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
        
        yPosition += lineHeight * 1.2;

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
        doc.rect(margin, yPosition - 2, maxWidth, lineHeight * 1.2, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Produto', margin + 2, yPosition);
        doc.text('Preco Unit', margin + 100, yPosition, { align: 'right' });
        doc.text('Qntd', margin + 130, yPosition, { align: 'right' });
        doc.text('Total', margin + 160, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight * 0.7;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 2, maxWidth, lineHeight * 1.0, 'F');
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
    yPosition += lineHeight * 1.0;

    // Totais - SEMPRE mostrar todos os campos (como na imagem laranja)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // SUBTOTAL (sempre mostrar)
    const subtotal = budget.subtotal_products + (budget.subtotal_services || 0);
    doc.text('SUBTOTAL:', margin + 100, yPosition, { align: 'right' });
    doc.text(formatCurrency(subtotal), margin + 160, yPosition, { align: 'right' });
    yPosition += lineHeight * 0.9;
    
    // DESCONTO (sempre mostrar, mesmo se zero)
    const discount = budget.additions < 0 ? Math.abs(budget.additions) : 0;
    doc.text('DESCONTO:', margin + 100, yPosition, { align: 'right' });
    doc.text(formatCurrency(discount), margin + 160, yPosition, { align: 'right' });
    yPosition += lineHeight * 0.9;
    
    // ACRÉSCIMO (sempre mostrar, mesmo se zero)
    const addition = budget.additions > 0 ? budget.additions : 0;
    doc.text('ACRESCIMO:', margin + 100, yPosition, { align: 'right' });
    doc.text(formatCurrency(addition), margin + 160, yPosition, { align: 'right' });
    yPosition += lineHeight * 0.9;
    
    // TOTAL (sempre mostrar)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const totalRgb = hexToRgb(headerColor);
    doc.setTextColor(totalRgb[0], totalRgb[1], totalRgb[2]);
    doc.text('TOTAL:', margin + 100, yPosition, { align: 'right' });
    doc.text(formatCurrency(budget.total || 0), margin + 160, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += lineHeight * 1.2;
  }

  // ==========================================
  // INFORMAÇÕES ADICIONAIS
  // ==========================================
  checkNewPage(lineHeight * 12);
  
  const leftInfoX = margin;
  const rightInfoX = margin + maxWidth / 2;
  let infoY = yPosition;

  // Coluna esquerda: Forma de Pagamento (SEMPRE mostrar, como na imagem laranja)
  writeTitle('FORMA DE PAGAMENTO', leftInfoX, infoY, 10);
  infoY += lineHeight * 0.9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (budget.payment_methods && budget.payment_methods.length > 0) {
    const paymentText = formatPaymentMethods(budget.payment_methods as any[]);
    const paymentLines = doc.splitTextToSize(paymentText, maxWidth / 2 - 5);
    paymentLines.forEach((line: string) => {
      doc.text(line, leftInfoX, infoY);
      infoY += lineHeight * 0.9;
    });
  } else {
    // Mostrar vazio se não houver método de pagamento
    doc.text('', leftInfoX, infoY);
    infoY += lineHeight * 0.9;
  }
  infoY += lineHeight * 0.3;

  // Coluna direita: Validade (SEMPRE mostrar, como na imagem laranja)
  let rightInfoY = yPosition;
  writeTitle('VALIDADE', rightInfoX, rightInfoY, 10);
  rightInfoY += lineHeight * 0.9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rightInfoY += lineHeight * 0.9;
  const validityDays = budget.validity_days || 15; // Padrão 15 dias como na imagem
  doc.text(`O presente orcamento possui validade de ${validityDays} dias uteis.`, rightInfoX, rightInfoY);
  rightInfoY += lineHeight * 0.9;
  doc.text('Apos o prazo entre em contato para novo orcamento.', rightInfoX, rightInfoY);
  rightInfoY += lineHeight * 1.0;

  yPosition = Math.max(infoY, rightInfoY) + lineHeight * 1.0;

  // Observações (se houver)
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
  // RODAPÉ - ASSINATURA
  // ==========================================
  // Garantir espaço suficiente para assinatura (pelo menos 25mm do final)
  const minSpaceForSignature = 25;
  if (yPosition + minSpaceForSignature > pageHeight - margin) {
    doc.addPage();
    drawPageHeader();
    yPosition = margin + 18;
  }
  
  // Linha separadora antes da assinatura
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 2;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Assinatura', pageWidth / 2, yPosition, { align: 'center' });

  // Rodapé com numeração de páginas (garantir que não fique cortado)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    // Posicionar rodapé com margem segura (10mm do final)
    const footerY = pageHeight - 10;
    doc.text(
      `Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  }

  // Gerar blob do PDF
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
