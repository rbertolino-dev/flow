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
  /** Título exibido no PDF (nome do contrato/template). Default: CONTRATATO */
  title?: string;
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
  const contractTitle = (options.title || 'CONTRATO').trim() || 'CONTRATO';

  // Folha de rosto: carregar uma vez e replicar em TODAS as páginas
  let coverImageDataUrl: string | null = null;
  if (options.coverPageUrl) {
    try {
      console.log('🖼️ Carregando folha de rosto:', options.coverPageUrl);
      coverImageDataUrl = await loadImage(options.coverPageUrl);
      if (coverImageDataUrl) {
        console.log('✅ Imagem da folha de rosto carregada');
      } else {
        console.warn('⚠️ Não foi possível carregar a imagem da folha de rosto');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar folha de rosto:', error);
    }
  }

  const applyCoverBackground = () => {
    if (!coverImageDataUrl) return;
    try {
      doc.addImage(
        coverImageDataUrl,
        'PNG',
        0,
        0,
        pageWidth,
        pageHeight,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.warn('⚠️ Erro ao aplicar folha de rosto na página:', error);
    }
  };

  applyCoverBackground();

  const addPageWithCover = () => {
    doc.addPage();
    applyCoverBackground();
    yPosition = margin;
  };

  // Função para adicionar nova página se necessário (com folha de rosto)
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      addPageWithCover();
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

  // Título do contrato (editável / nome do contrato)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(contractTitle.toUpperCase(), maxWidth);
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 1.2;
  });
  yPosition += lineHeight * 0.5;

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

      const placedSignerTypes = new Set<string>();

      // Adicionar assinaturas nas posições definidas
      for (const position of options.signaturePositions) {
        const signature = signatureMap.get(position.signerType);
        if (!signature) continue;
        placedSignerTypes.add(position.signerType);

        // Garantir que a página existe (com folha de rosto)
        while (doc.getNumberOfPages() < position.pageNumber) {
          addPageWithCover();
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
          placedSignerTypes.delete(position.signerType);
        }
      }

      const unplaced = options.signatures.filter(
        (sig) => !sig.signerType || !placedSignerTypes.has(sig.signerType)
      );
      if (unplaced.length > 0) {
        await drawSignatureBlocks(unplaced);
      }
    } else {
      await drawSignatureBlocks(options.signatures);
    }
  }

  async function drawSignatureBlocks(
    signatures: NonNullable<ContractPdfOptions['signatures']>
  ) {
      console.log('📝 Adicionando página de assinaturas com', signatures.length, 'assinatura(s)');
      const ordered = [...signatures].sort((a, b) => {
        const rank = (type?: string) => (type === 'user' ? 0 : type === 'client' ? 1 : 2);
        return rank(a.signerType) - rank(b.signerType);
      });
      addPageWithCover();

    // Título da seção de assinaturas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURAS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 2;

    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight * 2;

    // Usuário e cliente lado a lado para as duas assinaturas ficarem visíveis
    const columns = Math.min(ordered.length, 2);
    const gap = 8;
    const colWidth = (maxWidth - gap * (columns - 1)) / columns;
    const blockReserve = 78;

    for (let i = 0; i < ordered.length; i += columns) {
      const row = ordered.slice(i, i + columns);
      if (yPosition + blockReserve > pageHeight - margin) {
        addFooter(pageHeight - margin);
        addPageWithCover();
      }

      const rowTop = yPosition;
      let rowBottom = rowTop;

      for (let col = 0; col < row.length; col++) {
        const signature = row[col];
        const x = margin + col * (colWidth + gap);
        let y = rowTop;
        const role =
          signature.signerType === 'user'
            ? 'Usuário'
            : signature.signerType === 'client'
              ? 'Cliente'
              : 'Signatário';

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(role.toUpperCase(), x, y);
        y += lineHeight * 0.8;

        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        const nameLines = doc.splitTextToSize(signature.name, colWidth);
        nameLines.forEach((line: string) => {
          doc.text(line, x, y);
          y += lineHeight * 0.85;
        });

        if (signature.signedAt) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const signedDate = new Date(signature.signedAt);
          const dateStr = signedDate.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          doc.text(`Assinado em: ${dateStr}`, x, y);
          y += lineHeight;
        }

        try {
          const signatureImg = new Image();
          signatureImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            signatureImg.onload = () => resolve();
            signatureImg.onerror = () => reject(new Error('Erro ao carregar imagem da assinatura'));
            signatureImg.src = signature.signatureData;
          });

          const signatureWidth = Math.min(60, colWidth);
          const naturalHeight = (signatureImg.height / signatureImg.width) * signatureWidth;
          const signatureHeightImg = Math.min(naturalHeight, 28);

          doc.addImage(
            signatureImg,
            'PNG',
            x,
            y,
            signatureWidth,
            signatureHeightImg
          );
          y += signatureHeightImg + lineHeight * 0.6;
        } catch (error) {
          console.error('Erro ao adicionar assinatura ao PDF:', error);
          y += lineHeight * 2;
        }

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(x, y, x + colWidth, y);
        y += lineHeight * 0.5;

        if (signature.ipAddress || signature.validationHash) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(90, 90, 90);
          if (signature.ipAddress) {
            const ipText = signature.signedIpCountry
              ? `IP: ${signature.ipAddress} (${signature.signedIpCountry})`
              : `IP: ${signature.ipAddress}`;
            doc.text(ipText, x, y);
            y += lineHeight * 0.7;
          }
          if (signature.validationHash) {
            const shortHash = signature.validationHash.slice(0, 16);
            doc.text(`Hash: ${shortHash}…`, x, y);
            y += lineHeight * 0.7;
          }
        }

        rowBottom = Math.max(rowBottom, y);
      }

      yPosition = rowBottom + lineHeight;
    }

    addFooter(pageHeight - margin);
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

