// Função para gerar PDF do contrato usando jsPDF
// Nota: jsPDF precisa ser instalado: npm install jspdf

export interface SignaturePosition {
  signerType: 'user' | 'client' | 'rubric';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContractPdfOptions {
  content: string;
  contractNumber: string;
  leadName?: string;
  fileName?: string;
  coverPageUrl?: string; // URL da folha de rosto (imagem de fundo)
  organizationData?: {
    name?: string;
    logo_url?: string;
    address?: string;
    company_profile?: string;
    city?: string;
    state?: string;
    cnpj?: string;
    phone?: string;
    contact_email?: string;
  };
  signatures?: Array<{
    name: string;
    signatureData: string; // base64 PNG
    signedAt?: string; // Data/hora da assinatura
    ipAddress?: string; // IP do signatário
    userAgent?: string; // User Agent
    signedIpCountry?: string; // País do IP
    validationHash?: string; // Hash de validação
    signerType?: 'user' | 'client'; // Tipo de signatário para mapear com posições
  }>; // Assinaturas a serem adicionadas ao PDF
  signaturePositions?: SignaturePosition[]; // Posições definidas no builder (opcional)
}

import { jsPDF } from 'jspdf';

// Função auxiliar para carregar imagem com tratamento de CORS
async function loadImage(url: string): Promise<string | null> {
  try {
    // Se for imagem do Google Cloud Storage, tentar com no-cors primeiro
    if (url.includes('storage.googleapis.com')) {
      try {
        // Tentar com no-cors (não verifica CORS, mas pode não funcionar)
        const response = await fetch(url, {
          mode: 'no-cors',
          credentials: 'omit',
        });
        
        // Com no-cors, response.ok sempre é false, mas podemos tentar mesmo assim
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => {
              console.warn('⚠️ Erro ao converter imagem do Google Storage para base64. Pulando...');
              resolve(null);
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (noCorsError) {
        // Se no-cors falhar, tentar com cors
      }
      
      // Tentar com CORS normal
      try {
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

export async function generateContractPDF(options: ContractPdfOptions): Promise<Blob> {
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  // Configurações de página
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  const lineHeight = 7;
  let yPosition = margin;

  const organizationData = options.organizationData;
  const logoUrl = organizationData?.logo_url;

  // Adicionar folha de rosto como fundo (se fornecida)
  if (options.coverPageUrl) {
    try {
      console.log('🖼️ Carregando folha de rosto:', options.coverPageUrl);
      
      // Usar a função loadImage que já trata CORS
      const imageDataUrl = await loadImage(options.coverPageUrl);
      
      if (imageDataUrl) {
        console.log('✅ Imagem carregada com sucesso');
        
        // Adicionar imagem como fundo na primeira página
        // A imagem será redimensionada para encaixar exatamente na página A4 (210x297mm)
        doc.addImage(
          imageDataUrl,
          'PNG', // Usar PNG para suportar transparência
          0, // x: começa no canto superior esquerdo
          0, // y: começa no canto superior esquerdo
          pageWidth, // largura: exatamente a largura da página
          pageHeight, // altura: exatamente a altura da página
          undefined, // alias (opcional)
          'FAST' // compressão rápida
        );
        console.log('✅ Imagem adicionada ao PDF');
      } else {
        console.warn('⚠️ Não foi possível carregar a imagem da folha de rosto');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar folha de rosto:', error);
      // Continua sem a folha de rosto se houver erro
    }
  }

  // Função para adicionar nova página se necessário
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Cabeçalho com dados da organização (se disponível)
  if (organizationData) {
    const headerStartY = margin;
    let headerY = headerStartY;
    const logoSize = 20;
    const leftColumnX = margin;
    const rightColumnX = pageWidth - margin;
    const logoRightX = rightColumnX - logoSize;

    // Carregar e posicionar logo (se disponível)
    if (logoUrl) {
      try {
        const logoDataUrl = await loadImage(logoUrl);
        if (logoDataUrl) {
          const imageType = logoUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
          doc.addImage(logoDataUrl, imageType, logoRightX, headerStartY, logoSize, logoSize);
        }
      } catch (error) {
        console.warn('Erro ao carregar logo:', error);
      }
    }

    // Dados da organização no topo esquerdo
    if (organizationData.name) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(organizationData.name, leftColumnX, headerY);
      headerY += lineHeight * 0.9;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    if (organizationData.cnpj) {
      doc.text(`CNPJ: ${organizationData.cnpj}`, leftColumnX, headerY);
      headerY += lineHeight * 0.8;
    }

    if (organizationData.address) {
      const addressLines = doc.splitTextToSize(organizationData.address, 90);
      addressLines.forEach((line: string) => {
        doc.text(`Endereco: ${line}`, leftColumnX, headerY);
        headerY += lineHeight * 0.8;
      });
    }

    if (organizationData.phone) {
      doc.text(`Telefone: ${organizationData.phone}`, leftColumnX, headerY);
      headerY += lineHeight * 0.8;
    }

    if (organizationData.contact_email) {
      doc.text(`Email: ${organizationData.contact_email}`, leftColumnX, headerY);
      headerY += lineHeight * 0.8;
    }

    yPosition = Math.max(headerY + lineHeight, margin + 30);
  }

  // Título do contrato
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONTRATO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight * 2;

  // Número do contrato
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${options.contractNumber}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight * 2;

  // Linha separadora
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 2;

  // Conteúdo do contrato
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // Dividir conteúdo em parágrafos
  const paragraphs = options.content.split('\n\n').filter(p => p.trim());

  // Função auxiliar para adicionar rodapé em uma página
  const addFooter = (pageY: number) => {
    const currentDate = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Documento gerado em ${currentDate}`,
      pageWidth / 2,
      pageY,
      { align: 'center' }
    );
  };

  for (const paragraph of paragraphs) {
    // Verificar se precisa de nova página
    if (checkNewPage(lineHeight * 3)) {
      // Adicionar rodapé na página anterior antes de criar nova página
      addFooter(pageHeight - margin);
    }

    // Dividir parágrafo em linhas que cabem na largura
    const lines = doc.splitTextToSize(paragraph.trim(), maxWidth);
    
    for (const line of lines) {
      if (checkNewPage(lineHeight)) {
        // Adicionar rodapé na página anterior antes de criar nova página
        addFooter(pageHeight - margin);
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    }

    // Espaço entre parágrafos
    yPosition += lineHeight * 0.5;
  }

  // Adicionar rodapé na última página de conteúdo
  addFooter(pageHeight - margin);

  // Adicionar assinaturas
  console.log('📝 Gerando PDF - Assinaturas recebidas:', options.signatures?.length || 0);
  console.log('📝 Posições definidas:', options.signaturePositions?.length || 0);
  
  if (options.signatures && options.signatures.length > 0) {
    // Se houver posições definidas no builder, usar essas posições
    if (options.signaturePositions && options.signaturePositions.length > 0) {
      console.log('📝 Usando posições definidas no builder');
      
      // Mapear assinaturas para posições
      const signatureMap = new Map<string, typeof options.signatures[0]>();
      options.signatures.forEach(sig => {
        if (sig.signerType) {
          signatureMap.set(sig.signerType, sig);
        }
      });

      // Adicionar assinaturas nas posições definidas
      for (const position of options.signaturePositions) {
        const signature = signatureMap.get(position.signerType);
        if (!signature) continue;

        // Garantir que a página existe
        while (doc.getNumberOfPages() < position.pageNumber) {
          doc.addPage();
        }

        // Ir para a página correta
        doc.setPage(position.pageNumber);
        
        // Converter coordenadas de pixels para mm (assumindo que o PDF foi renderizado em escala)
        // Nota: As coordenadas do builder são em pixels da renderização, precisamos converter
        // Para simplificar, vamos assumir que o PDF tem 210mm de largura (A4)
        // e que o container de renderização tem uma largura conhecida
        // Por enquanto, vamos usar as coordenadas diretamente como mm (ajustar depois se necessário)
        const xMm = (position.x / 10); // Aproximação: 10px = 1mm
        const yMm = (position.y / 10);
        const widthMm = (position.width / 10);
        const heightMm = (position.height / 10);

        try {
          const signatureImg = new Image();
          signatureImg.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            signatureImg.onload = () => resolve();
            signatureImg.onerror = () => reject(new Error('Erro ao carregar imagem da assinatura'));
            signatureImg.src = signature.signatureData;
          });

          // Adicionar assinatura na posição definida
          doc.addImage(
            signatureImg,
            'PNG',
            xMm,
            yMm,
            widthMm,
            heightMm
          );

          // Adicionar nome do signatário acima da assinatura
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(signature.name, xMm, yMm - 3);
        } catch (error) {
          console.error('Erro ao adicionar assinatura na posição:', error);
        }
      }
    } else {
      // Comportamento padrão: adicionar assinaturas no final
      console.log('📝 Adicionando página de assinaturas com', options.signatures.length, 'assinatura(s)');
      // Criar nova página dedicada para assinaturas
      doc.addPage();
      yPosition = margin;

    // Título da seção de assinaturas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURAS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 2;

    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 2;

    // Adicionar cada assinatura
    const signatureHeight = 40; // Altura estimada para cada assinatura
    
    for (let i = 0; i < options.signatures.length; i++) {
      const signature = options.signatures[i];
      console.log(`📝 Processando assinatura ${i + 1}/${options.signatures.length}:`, signature.name);
      
      // Verificar se precisa de nova página para próxima assinatura
      if (yPosition + signatureHeight + lineHeight * 3 > pageHeight - margin - 10) {
        // Adicionar rodapé na página atual antes de criar nova
        addFooter(pageHeight - margin);
        doc.addPage();
        yPosition = margin;
      }

      // Nome do signatário
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(signature.name, margin, yPosition);
      yPosition += lineHeight;

      // Data e hora da assinatura
      if (signature.signedAt) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const signedDate = new Date(signature.signedAt);
        const dateStr = signedDate.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        doc.text(`Assinado em: ${dateStr}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Adicionar imagem da assinatura
      try {
        const signatureImg = new Image();
        signatureImg.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          signatureImg.onload = () => resolve();
          signatureImg.onerror = () => reject(new Error('Erro ao carregar imagem da assinatura'));
          signatureImg.src = signature.signatureData;
        });

        // Adicionar assinatura (largura máxima de 60mm, altura proporcional)
        const signatureWidth = 60;
        const signatureHeightImg = (signatureImg.height / signatureImg.width) * signatureWidth;
        
        doc.addImage(
          signatureImg,
          'PNG',
          margin,
          yPosition,
          signatureWidth,
          signatureHeightImg
        );

        yPosition += signatureHeightImg + lineHeight * 1.5;
      } catch (error) {
        console.error('Erro ao adicionar assinatura ao PDF:', error);
        yPosition += lineHeight * 3; // Espaço mesmo se falhar
      }

      // Dados de autenticação (se disponíveis)
      const hasAuthData = !!(signature.ipAddress || signature.userAgent || signature.validationHash);
      if (hasAuthData) {
        // Linha separadora antes dos dados de autenticação
        doc.setLineWidth(0.2);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Dados de Autenticação:', margin, yPosition);
        yPosition += lineHeight * 0.8;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        
        if (signature.ipAddress) {
          let ipText = `IP: ${signature.ipAddress}`;
          if (signature.signedIpCountry) {
            ipText += ` (${signature.signedIpCountry})`;
          }
          doc.text(ipText, margin + 5, yPosition);
          yPosition += lineHeight * 0.7;
        }

        if (signature.userAgent) {
          // Truncar user agent se muito longo
          const maxUserAgentLength = 80;
          let userAgentText = signature.userAgent;
          if (userAgentText.length > maxUserAgentLength) {
            userAgentText = userAgentText.substring(0, maxUserAgentLength) + '...';
          }
          const userAgentLines = doc.splitTextToSize(`Dispositivo: ${userAgentText}`, maxWidth - 10);
          userAgentLines.forEach((line: string) => {
            doc.text(line, margin + 5, yPosition);
            yPosition += lineHeight * 0.7;
          });
        }

        if (signature.validationHash) {
          // Hash completo em linha separada
          const hashLines = doc.splitTextToSize(
            `Hash Validação: ${signature.validationHash}`,
            maxWidth - 10
          );
          hashLines.forEach((line: string) => {
            doc.text(line, margin + 5, yPosition);
            yPosition += lineHeight * 0.7;
          });
        }

        yPosition += lineHeight;
      }
    }

      // Adicionar rodapé na última página de assinaturas
      addFooter(pageHeight - margin);
    }
  }

  // Gerar blob do PDF
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

// Função alternativa usando API externa (fallback)
export async function generateContractPDFViaAPI(
  content: string,
  contractNumber: string
): Promise<Blob> {
  // Esta função pode ser usada como fallback se jsPDF não estiver disponível
  // Requer uma API externa de geração de PDF (ex: Puppeteer, PDFShift, etc.)
  
  throw new Error('Geração de PDF via API não implementada. Use generateContractPDF com jsPDF.');
}

