// Função para gerar PDF de orçamento usando jsPDF
// Design moderno e compacto baseado na imagem de referência
import { BudgetPdfOptions, Budget } from '@/types/budget';
import { formatPaymentMethods } from '@/lib/paymentMethods';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';

// Função auxiliar para carregar imagem
async function loadImage(url: string): Promise<string | null> {
  try {
    if (url.includes('storage.googleapis.com')) {
      try {
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache',
        });
        
        if (!response.ok) {
          console.warn('⚠️ Imagem do Google Cloud Storage não acessível:', response.statusText);
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
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (corsError: any) {
        console.warn('⚠️ Erro de CORS ao carregar imagem:', url);
        return null;
      }
    }
    
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      console.warn('⚠️ Erro ao carregar imagem:', response.statusText);
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
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    if (error.message?.includes('CORS') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('ERR_FAILED') ||
        error.name === 'TypeError') {
      console.warn('⚠️ Erro ao carregar imagem (CORS/Network):', url);
      return null;
    }
    console.warn('⚠️ Erro ao carregar imagem:', error.message || error);
    return null;
  }
}

export async function generateBudgetPDF(options: BudgetPdfOptions): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  // Configurações de página - mais compacto
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);
  const lineHeight = 4.5; // Reduzido para layout mais compacto
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
      : [59, 130, 246];
  };

  // Função para formatar moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para escrever título em vermelho (como na imagem)
  const writeRedTitle = (text: string, x: number, y: number, fontSize: number = 9) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(200, 0, 0); // Vermelho
    doc.text(text, x, y);
    doc.setTextColor(0, 0, 0); // Voltar para preto
  };

  // Função para desenhar linha separadora cinza
  const drawSeparator = (y: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // Função para adicionar nova página se necessário
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 20) {
      doc.addPage();
      yPosition = margin + 5;
      return true;
    }
    return false;
  };

  // ==========================================
  // HEADER - Primeira página
  // ==========================================
  yPosition = margin;

  // ==========================================
  // CABEÇALHO COM LOGO E DADOS DA ORGANIZAÇÃO
  // Layout: Esquerda = Dados org | Direita = Logo + Datas
  // ==========================================
  const headerStartY = margin;
  const logoSize = 20;
  const leftColumnX = margin;
  const rightColumnX = pageWidth - margin;
  const logoRightX = rightColumnX - logoSize - 5;
  
  // Carregar logo
  let logoLoaded = false;
  let logoHeight = logoSize;
  if (logoUrl) {
    try {
      const logoDataUrl = await loadImage(logoUrl);
      if (logoDataUrl) {
        const imageType = logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
        doc.addImage(logoDataUrl, imageType, logoRightX, headerStartY, logoSize, logoSize);
        logoLoaded = true;
      }
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }

  // Dados da organização no topo esquerdo
  let orgDataY = headerStartY;
  const orgName = organizationData?.name || '';
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(orgName, leftColumnX, orgDataY);
  orgDataY += lineHeight * 0.9;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  
  if (organizationData?.cnpj) {
    doc.text(`CNPJ: ${organizationData.cnpj}`, leftColumnX, orgDataY);
    orgDataY += lineHeight * 0.8;
  }
  
  if (organizationData?.address) {
    const addressLines = doc.splitTextToSize(organizationData.address, 85);
    addressLines.forEach((line: string) => {
      doc.text(`Endereco: ${line}`, leftColumnX, orgDataY);
      orgDataY += lineHeight * 0.8;
    });
  }
  
  if (organizationData?.phone) {
    doc.text(`Telefone: ${organizationData.phone}`, leftColumnX, orgDataY);
    orgDataY += lineHeight * 0.8;
  }
  
  if (organizationData?.contact_email) {
    doc.text(`Email: ${organizationData.contact_email}`, leftColumnX, orgDataY);
    orgDataY += lineHeight * 0.8;
  }
  
  // Lado direito: Logo + Datas
  let headerRightY = headerStartY;
  if (logoLoaded) {
    headerRightY += logoHeight / 2;
  }
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Emissao: ${format(new Date(budget.created_at), 'dd/MM/yyyy')}`, rightColumnX, headerRightY, { align: 'right' });
  headerRightY += lineHeight * 0.9;
  
  if (budget.delivery_date) {
    doc.text(`Data de entrega: ${format(new Date(budget.delivery_date), 'dd/MM/yyyy')}`, rightColumnX, headerRightY, { align: 'right' });
    headerRightY += lineHeight * 0.9;
  }

  // Linha separadora após cabeçalho
  let currentY = Math.max(orgDataY, headerRightY) + lineHeight * 0.5;
  drawSeparator(currentY);
  currentY += lineHeight * 0.6;
  
  yPosition = currentY;

  // ==========================================
  // NÚMERO DO ORÇAMENTO E LOCAL DE ENTREGA
  // ==========================================
  checkNewPage(lineHeight * 3);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`Orcamento N°: ${budget.budget_number}`, leftColumnX, yPosition);
  yPosition += lineHeight * 0.9;
  
  if (budget.delivery_location) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Local de entrega: ${budget.delivery_location}`, leftColumnX, yPosition);
    yPosition += lineHeight * 0.9;
  }
  
  yPosition += lineHeight * 0.5;
  drawSeparator(yPosition);
  yPosition += lineHeight * 0.6;

  // ==========================================
  // DADOS DO CLIENTE
  // Layout: Duas colunas (Esquerda: Endereço, Bairro, Email | Direita: CPF, CEP, Cidade, Telefone)
  // ==========================================
  checkNewPage(lineHeight * 8);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Cliente:', leftColumnX, yPosition);
  yPosition += lineHeight * 0.8;
  
  const client = budget.client_data || budget.lead;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  const clientName = client?.name || '';
  if (clientName) {
    doc.text(clientName, leftColumnX, yPosition);
    yPosition += lineHeight * 0.9;
  }
  
  const leftColX = leftColumnX;
  const rightColX = leftColumnX + maxWidth / 2 + 10;
  let leftY = yPosition;
  let rightY = yPosition;
  
  // Coluna esquerda
  doc.text(`Endereco: ${(client as any)?.address || client?.company || ''}`, leftColX, leftY);
  leftY += lineHeight * 0.8;
  doc.text(`Bairro: ${(client as any)?.neighborhood || ''}`, leftColX, leftY);
  leftY += lineHeight * 0.8;
  doc.text(`Email: ${client?.email || ''}`, leftColX, leftY);
  leftY += lineHeight * 0.8;
  
  // Coluna direita
  const cpfCnpj = (client as any)?.cpf_cnpj;
  if (cpfCnpj) {
    doc.text(`CPF: ${cpfCnpj}`, rightColX, rightY);
    rightY += lineHeight * 0.8;
  }
  
  const cep = (client as any)?.cep || (client as any)?.zip_code;
  if (cep) {
    doc.text(`CEP: ${cep}`, rightColX, rightY);
    rightY += lineHeight * 0.8;
  }
  
  doc.text(`Cidade: ${(client as any)?.city || ''}`, rightColX, rightY);
  rightY += lineHeight * 0.8;
  doc.text(`Telefone: ${client?.phone || ''}`, rightColX, rightY);
  rightY += lineHeight * 0.8;
  
  yPosition = Math.max(leftY, rightY) + lineHeight * 0.8;
  drawSeparator(yPosition);
  yPosition += lineHeight * 0.6;

  // ==========================================
  // TABELA DE SERVIÇOS (se houver)
  // ==========================================
  if (budget.services && budget.services.length > 0) {
    checkNewPage(lineHeight * 12);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('Servico', leftColumnX, yPosition);
    yPosition += lineHeight * 1.0;
    
    // Cabeçalho da tabela
    const headerRgb = hexToRgb(headerColor);
    const lightR = Math.min(255, headerRgb[0] + 220);
    const lightG = Math.min(255, headerRgb[1] + 220);
    const lightB = Math.min(255, headerRgb[2] + 220);
    doc.setFillColor(lightR, lightG, lightB);
    doc.rect(leftColumnX, yPosition - 2.5, maxWidth, lineHeight * 1.2, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Colunas: Serviço, Preço Unit, Qntd, Total
    doc.text('Servico', leftColumnX + 2, yPosition);
    doc.text('Preco Unit', leftColumnX + 120, yPosition, { align: 'right' });
    doc.text('Qntd', leftColumnX + 150, yPosition, { align: 'right' });
    doc.text('Total', leftColumnX + 170, yPosition, { align: 'right' });
    yPosition += lineHeight * 1.0;

    drawSeparator(yPosition);
    yPosition += lineHeight * 0.6;

    // Itens da tabela
    doc.setFont('helvetica', 'normal');
    let rowIndex = 0;
    for (const service of budget.services) {
      if (checkNewPage(lineHeight * 3)) {
        const headerRgbNew = hexToRgb(headerColor);
        const lightR = Math.min(255, headerRgbNew[0] + 220);
        const lightG = Math.min(255, headerRgbNew[1] + 220);
        const lightB = Math.min(255, headerRgbNew[2] + 220);
        doc.setFillColor(lightR, lightG, lightB);
        doc.rect(leftColumnX, yPosition - 2, maxWidth, lineHeight * 1.0, 'F');
        
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Servico', leftColumnX + 2, yPosition);
        doc.text('Preco Unit', leftColumnX + 120, yPosition, { align: 'right' });
        doc.text('Qntd', leftColumnX + 150, yPosition, { align: 'right' });
        doc.text('Total', leftColumnX + 170, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.0;
        drawSeparator(yPosition);
        yPosition += lineHeight * 0.6;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(leftColumnX, yPosition - 2, maxWidth, lineHeight * 0.9, 'F');
      }

      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      
      const descLines = doc.splitTextToSize(service.name || '', 100);
      doc.text(descLines[0], leftColumnX + 2, yPosition);
      doc.text(formatCurrency(service.price || 0), leftColumnX + 120, yPosition, { align: 'right' });
      doc.text((service.quantity || 1).toString(), leftColumnX + 150, yPosition, { align: 'right' });
      doc.text(formatCurrency(service.subtotal || (service.price || 0) * (service.quantity || 1)), leftColumnX + 170, yPosition, { align: 'right' });
      
      yPosition += lineHeight * 0.9;

      for (let i = 1; i < descLines.length; i++) {
        if (checkNewPage(lineHeight)) {
          yPosition += lineHeight * 0.5;
        }
        doc.text(descLines[i], leftColumnX + 5, yPosition);
        yPosition += lineHeight * 0.8;
      }

      rowIndex++;
    }

    yPosition += lineHeight * 0.5;
    drawSeparator(yPosition);
    yPosition += lineHeight * 0.6;
  }

  // ==========================================
  // TABELA DE PRODUTOS (se houver)
  // ==========================================
  if (budget.products && budget.products.length > 0) {
    checkNewPage(lineHeight * 12);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('Produto', leftColumnX, yPosition);
    yPosition += lineHeight * 1.0;
    
    // Cabeçalho da tabela
    const headerRgb = hexToRgb(headerColor);
    const lightR = Math.min(255, headerRgb[0] + 220);
    const lightG = Math.min(255, headerRgb[1] + 220);
    const lightB = Math.min(255, headerRgb[2] + 220);
    doc.setFillColor(lightR, lightG, lightB);
    doc.rect(leftColumnX, yPosition - 2.5, maxWidth, lineHeight * 1.2, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Colunas: Produto, Preço Unit, Qntd, Total
    doc.text('Produto', leftColumnX + 2, yPosition);
    doc.text('Preco Unit', leftColumnX + 120, yPosition, { align: 'right' });
    doc.text('Qntd', leftColumnX + 150, yPosition, { align: 'right' });
    doc.text('Total', leftColumnX + 170, yPosition, { align: 'right' });
    yPosition += lineHeight * 1.0;

    drawSeparator(yPosition);
    yPosition += lineHeight * 0.6;

    // Itens da tabela
    doc.setFont('helvetica', 'normal');
    let rowIndex = 0;
    for (const product of budget.products) {
      if (checkNewPage(lineHeight * 3)) {
        const headerRgbNew = hexToRgb(headerColor);
        const lightR = Math.min(255, headerRgbNew[0] + 220);
        const lightG = Math.min(255, headerRgbNew[1] + 220);
        const lightB = Math.min(255, headerRgbNew[2] + 220);
        doc.setFillColor(lightR, lightG, lightB);
        doc.rect(leftColumnX, yPosition - 2, maxWidth, lineHeight * 1.0, 'F');
        
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Produto', leftColumnX + 2, yPosition);
        doc.text('Preco Unit', leftColumnX + 120, yPosition, { align: 'right' });
        doc.text('Qntd', leftColumnX + 150, yPosition, { align: 'right' });
        doc.text('Total', leftColumnX + 170, yPosition, { align: 'right' });
        yPosition += lineHeight * 1.0;
        drawSeparator(yPosition);
        yPosition += lineHeight * 0.6;
        doc.setFont('helvetica', 'normal');
        rowIndex = 0;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(leftColumnX, yPosition - 2, maxWidth, lineHeight * 0.9, 'F');
      }

      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      
      const descLines = doc.splitTextToSize(product.name || '', 100);
      doc.text(descLines[0], leftColumnX + 2, yPosition);
      doc.text(formatCurrency(product.price || 0), leftColumnX + 120, yPosition, { align: 'right' });
      doc.text((product.quantity || 1).toString(), leftColumnX + 150, yPosition, { align: 'right' });
      doc.text(formatCurrency(product.subtotal || (product.price || 0) * (product.quantity || 1)), leftColumnX + 170, yPosition, { align: 'right' });
      
      yPosition += lineHeight * 0.9;

      for (let i = 1; i < descLines.length; i++) {
        if (checkNewPage(lineHeight)) {
          yPosition += lineHeight * 0.5;
        }
        doc.text(descLines[i], leftColumnX + 5, yPosition);
        yPosition += lineHeight * 0.8;
      }

      rowIndex++;
    }

    yPosition += lineHeight * 0.5;
    drawSeparator(yPosition);
    yPosition += lineHeight * 0.6;
  }

  // ==========================================
  // TOTAIS - Alinhados à direita
  // ==========================================
  checkNewPage(lineHeight * 6);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const subtotal = budget.subtotal_products + (budget.subtotal_services || 0);
  doc.text('SUBTOTAL:', leftColumnX + 120, yPosition, { align: 'right' });
  doc.text(formatCurrency(subtotal), leftColumnX + 170, yPosition, { align: 'right' });
  yPosition += lineHeight * 0.8;
  
  const discount = budget.additions < 0 ? Math.abs(budget.additions) : 0;
  doc.text('DESCONTO:', leftColumnX + 120, yPosition, { align: 'right' });
  doc.text(formatCurrency(discount), leftColumnX + 170, yPosition, { align: 'right' });
  yPosition += lineHeight * 0.8;
  
  const addition = budget.additions > 0 ? budget.additions : 0;
  doc.text('ACRESCIMO:', leftColumnX + 120, yPosition, { align: 'right' });
  doc.text(formatCurrency(addition), leftColumnX + 170, yPosition, { align: 'right' });
  yPosition += lineHeight * 0.8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const totalRgb = hexToRgb(headerColor);
  doc.setTextColor(totalRgb[0], totalRgb[1], totalRgb[2]);
  doc.text('TOTAL:', leftColumnX + 120, yPosition, { align: 'right' });
  doc.text(formatCurrency(budget.total || 0), leftColumnX + 170, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += lineHeight * 1.0;
  
  drawSeparator(yPosition);
  yPosition += lineHeight * 0.8;

  // ==========================================
  // INFORMAÇÕES ADICIONAIS
  // Layout: Esquerda = Formas de pagamento + Validade | Direita = Contato responsável
  // ==========================================
  checkNewPage(lineHeight * 10);
  
  const leftInfoX = leftColumnX;
  const rightInfoX = leftColumnX + maxWidth / 2 + 10;
  let infoY = yPosition;

  // Coluna esquerda: Formas de pagamento (título em vermelho)
  writeRedTitle('• Formas de pagamento', leftInfoX, infoY, 8);
  infoY += lineHeight * 0.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (budget.payment_methods && budget.payment_methods.length > 0) {
    const paymentText = formatPaymentMethods(budget.payment_methods as any[]);
    const paymentLines = doc.splitTextToSize(paymentText, maxWidth / 2 - 5);
    paymentLines.forEach((line: string) => {
      doc.text(line, leftInfoX, infoY);
      infoY += lineHeight * 0.8;
    });
  } else {
    doc.text('', leftInfoX, infoY);
    infoY += lineHeight * 0.8;
  }
  infoY += lineHeight * 0.5;

  // Validade (título em vermelho)
  writeRedTitle('• Validade', leftInfoX, infoY, 8);
  infoY += lineHeight * 0.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const validityDays = budget.validity_days || 7;
  const validityText = `O presente orcamento possui validade de ${validityDays} dias uteis. Apos o prazo entre em contato para novo orcamento.`;
  const validityLines = doc.splitTextToSize(validityText, maxWidth / 2 - 5);
  validityLines.forEach((line: string) => {
    doc.text(line, leftInfoX, infoY);
    infoY += lineHeight * 0.8;
  });

  // Coluna direita: Contato responsável (título em vermelho)
  let rightInfoY = yPosition;
  writeRedTitle('Contato responsavel:', rightInfoX, rightInfoY, 8);
  rightInfoY += lineHeight * 0.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  // Dados do contato responsável (da organização)
  if (organizationData?.phone) {
    doc.text(organizationData.phone, rightInfoX, rightInfoY, { align: 'right' });
    rightInfoY += lineHeight * 0.8;
  }
  if (organizationData?.contact_email) {
    doc.text(organizationData.contact_email, rightInfoX, rightInfoY, { align: 'right' });
    rightInfoY += lineHeight * 0.8;
  }

  yPosition = Math.max(infoY, rightInfoY) + lineHeight * 0.8;

  // Observações (se houver)
  if (budget.observations) {
    checkNewPage(lineHeight * 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(budget.observations, maxWidth);
    obsLines.forEach((line: string) => {
      if (checkNewPage(lineHeight)) {
        yPosition += lineHeight * 0.5;
      }
      doc.text(line, leftColumnX, yPosition);
      yPosition += lineHeight * 0.8;
    });
  }

  // ==========================================
  // RODAPÉ - ASSINATURA
  // ==========================================
  const minSpaceForSignature = 20;
  if (yPosition + minSpaceForSignature > pageHeight - margin) {
    doc.addPage();
    yPosition = margin + 5;
  }
  
  drawSeparator(yPosition);
  yPosition += lineHeight * 1.5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Assinatura', pageWidth / 2, yPosition, { align: 'center' });

  // Rodapé com numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const footerY = pageHeight - 8;
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
