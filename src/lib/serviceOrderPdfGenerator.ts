import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ServiceOrder, ServiceOrderTemplateField, fieldsShownOnPdf } from '@/types/serviceOrder';
import { organizationNameForDocuments } from '@/lib/organizationDisplayName';
import { fitImageInBox, loadImageForBudgetPdf } from '@/lib/budgetPdfImage';

export interface ServiceOrderPdfOptions {
  order: ServiceOrder;
  /** full = com valores; no_values = sem preços/totais, inclui fechamento */
  mode?: 'full' | 'no_values';
  organizationName?: string;
  organizationData?: {
    name?: string | null;
    company_profile?: string | null;
    logo_url?: string | null;
  } | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function asText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function nonempty(value: unknown): string | null {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  const text = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value).trim();
  return text ? text : null;
}

function valueForTemplateField(
  order: ServiceOrder,
  field: ServiceOrderTemplateField,
  includeValues: boolean
): string | null {
  const key = field.field_key;
  if (key === 'commission_value' && !includeValues) return null;

  if (key === 'lead_id') {
    return nonempty(
      [order.client_name || order.lead?.name, order.client_phone || order.lead?.phone].filter(Boolean).join(' · ')
    );
  }
  if (key === 'is_single_day') return order.is_single_day ? 'Um dia só' : 'Mais de um dia';
  if (key === 'starts_at') return nonempty(formatDateTime(order.starts_at));
  if (key === 'ends_at') return nonempty(formatDateTime(order.ends_at));
  if (key === 'has_commission') return order.has_commission ? 'Sim' : null;
  if (key === 'commission_value') {
    const amount = Number(order.commission_value || 0);
    return amount > 0 ? formatCurrency(amount) : null;
  }
  if (key === 'add_to_agilize_calendar') return order.add_to_agilize_calendar ? 'Sim' : 'Não';
  if (key === 'add_to_google_calendar') return order.add_to_google_calendar ? 'Sim' : 'Não';

  const direct = order as unknown as Record<string, unknown>;
  const raw = key in direct && key !== 'custom_fields' ? direct[key] : order.custom_fields?.[key];
  if (field.field_type === 'date') return nonempty(formatDate(raw ? String(raw) : null));
  if (field.field_type === 'datetime') return nonempty(formatDateTime(raw ? String(raw) : null));
  if (typeof raw === 'boolean') return raw ? 'Sim' : 'Não';
  return nonempty(raw);
}

/**
 * Gera PDF da Ordem de Serviço.
 * mode=full: inclui valores/produtos com preços
 * mode=no_values: omite valores monetários; inclui execução, fotos e assinatura do fechamento
 */
export async function generateServiceOrderPDF(options: ServiceOrderPdfOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const order = options.order;
  const includeValues = (options.mode || 'full') !== 'no_values';
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const orgName =
    options.organizationName ||
    organizationNameForDocuments(options.organizationData) ||
    'Agilize Flow';

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, y, maxWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 4.8);
    doc.setTextColor(0, 0, 0);
    y += 11;
  };

  const field = (label: string, value: string, fullWidth = false) => {
    const colW = fullWidth ? maxWidth : (maxWidth - 4) / 2;
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value || '—', colW);
    doc.text(lines, margin, y + 4.5);
    const blockH = Math.max(10, lines.length * 4.5 + 4);
    return blockH;
  };

  const fieldPair = (left: [string, string], right: [string, string]) => {
    ensureSpace(14);
    const colW = (maxWidth - 4) / 2;
    const startY = y;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(left[0].toUpperCase(), margin, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const leftLines = doc.splitTextToSize(left[1] || '—', colW);
    doc.text(leftLines, margin, startY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(right[0].toUpperCase(), margin + colW + 4, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const rightLines = doc.splitTextToSize(right[1] || '—', colW);
    doc.text(rightLines, margin + colW + 4, startY + 4.5);

    y = startY + Math.max(leftLines.length, rightLines.length) * 4.5 + 6;
  };

  const paragraph = (label: string, value?: string | null) => {
    if (!value?.trim()) return;
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value, maxWidth);
    ensureSpace(lines.length * 4.5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ORDEM DE SERVIÇO', margin, 12);
  doc.setFontSize(11);
  doc.text(`Nº ${order.code}`, margin, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(orgName, pageWidth - margin, 12, { align: 'right' });
  doc.text(
    includeValues ? 'PDF completo' : 'PDF sem valores',
    pageWidth - margin,
    20,
    { align: 'right' }
  );
  y = 36;

  if (order.status?.name) {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Etapa / Status:', margin, y);
    const statusColor = order.status.color || '#64748b';
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(statusColor);
    const r = rgb ? parseInt(rgb[1], 16) : 100;
    const g = rgb ? parseInt(rgb[2], 16) : 116;
    const b = rgb ? parseInt(rgb[3], 16) : 139;
    doc.setFillColor(r, g, b);
    const label = order.status.name + (order.is_closed ? ' (Encerrada)' : '');
    const tw = doc.getTextWidth(label) + 6;
    doc.roundedRect(margin + 28, y - 4.5, tw, 6.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(label, margin + 31, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  const pdfFields = order.template?.fields?.length
    ? fieldsShownOnPdf(order.template)
    : [];

  if (pdfFields.length > 0) {
    const printable = pdfFields
      .filter((field) => field.field_key !== 'is_single_day')
      .filter((field) => !(field.field_key === 'ends_at' && order.is_single_day))
      .map((field) => ({
        label:
          field.field_key === 'starts_at'
            ? order.is_single_day
              ? 'Dia e horário'
              : 'Início'
            : field.field_key === 'ends_at'
              ? 'Fim'
              : field.label,
        value: valueForTemplateField(order, field, includeValues),
        wide: field.field_type === 'textarea' || field.field_key === 'address',
      }))
      .filter((row): row is { label: string; value: string; wide: boolean } => !!row.value);

    if (order.label_tag) {
      printable.push({ label: 'Etiqueta', value: order.label_tag, wide: false });
    }

    if (printable.length > 0) {
      sectionTitle('Dados da ordem');
    }

    let index = 0;
    while (index < printable.length) {
      const current = printable[index];
      const next = printable[index + 1];
      if (!current.wide && next && !next.wide) {
        fieldPair([current.label, current.value], [next.label, next.value]);
        index += 2;
      } else if (current.wide) {
        paragraph(current.label, current.value);
        index += 1;
      } else {
        const h = field(current.label, current.value, true);
        y += h;
        index += 1;
      }
    }
  } else {
  sectionTitle('Dados gerais');
  fieldPair(
    ['Cliente', order.client_name || order.lead?.name || '—'],
    ['Telefone', order.client_phone || order.lead?.phone || '—']
  );
  fieldPair(
    ['Responsável', order.responsible_name || '—'],
    ['Colaborador', order.collaborator_name || '—']
  );
  fieldPair(
    ['Serviço', order.service_name || '—'],
    ['Etiqueta', order.label_tag || '—']
  );
  if (order.is_single_day) {
    fieldPair(
      ['Dia e horário', formatDateTime(order.starts_at)],
      ['Modelo', order.template?.name || '—']
    );
  } else {
    fieldPair(
      ['Início', formatDateTime(order.starts_at)],
      ['Fim', formatDateTime(order.ends_at)]
    );
    const h = field('Modelo', order.template?.name || '—', true);
    y += h;
  }
  if (order.address) {
    const h = field('Endereço', order.address, true);
    y += h;
  }

  if (includeValues && (order.has_commission || (order.commission_value && order.commission_value > 0))) {
    sectionTitle('Comissão');
    fieldPair(
      ['Empresa comissionada', order.has_commission ? 'Sim' : 'Não'],
      ['Valor da comissão', formatCurrency(Number(order.commission_value || 0))]
    );
  }

  if (order.template?.is_default === false && (order.equipment_serial || order.equipment_conditions)) {
    sectionTitle('Equipamento');
    fieldPair(
      ['Nº de série', order.equipment_serial || '—'],
      ['Condições atuais', order.equipment_conditions || '—']
    );
  }

  sectionTitle('Descrição do serviço');
  paragraph('Relato do cliente', order.client_report);
  paragraph('Diagnóstico / Problema', order.diagnosis);
  paragraph('Solução / Instrução', order.solution);
  paragraph('Termo de garantia', order.warranty_terms);

  const customEntries = Object.entries(order.custom_fields || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (customEntries.length > 0) {
    sectionTitle('Campos personalizados');
    for (let i = 0; i < customEntries.length; i += 2) {
      const [k1, v1] = customEntries[i];
      const second = customEntries[i + 1];
      if (second) {
        fieldPair([k1, asText(v1)], [second[0], asText(second[1])]);
      } else {
        const h = field(k1, asText(v1), true);
        y += h;
      }
    }
  }
  }

  const items = order.items || [];
  if (items.length > 0) {
    sectionTitle(includeValues ? 'Produtos e serviços utilizados' : 'Itens utilizados (sem valores)');
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Item', margin, y);
    doc.text('Qtd', margin + 120, y);
    if (includeValues) {
      doc.text('Unit.', margin + 140, y);
      doc.text('Total', margin + 165, y);
    }
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    items.forEach((item) => {
      ensureSpace(8);
      const nameLines = doc.splitTextToSize(
        `${item.name}${item.item_type === 'service' ? ' (serviço)' : ''}`,
        includeValues ? 110 : 150
      );
      doc.text(nameLines, margin, y);
      doc.text(String(item.quantity), margin + 120, y);
      if (includeValues) {
        doc.text(formatCurrency(item.unit_price), margin + 140, y);
        doc.text(formatCurrency(item.total_price), margin + 165, y);
      }
      y += Math.max(6, nameLines.length * 4);
    });

    if (includeValues) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal: ${formatCurrency(order.subtotal || 0)}`, pageWidth - margin, y, {
        align: 'right',
      });
      y += 5;
      if (order.discount > 0) {
        doc.text(`Desconto: ${formatCurrency(order.discount)}`, pageWidth - margin, y, {
          align: 'right',
        });
        y += 5;
      }
      doc.setFontSize(12);
      doc.text(`TOTAL: ${formatCurrency(order.total || 0)}`, pageWidth - margin, y, {
        align: 'right',
      });
      y += 8;
    } else {
      y += 4;
    }
  } else if (includeValues) {
    sectionTitle('Valores');
    fieldPair(
      ['Subtotal', formatCurrency(order.subtotal || 0)],
      ['Total da O.S.', formatCurrency(order.total || 0)]
    );
  }

  const checklist = (order.checklist || [])
    .filter((c) => c.include_in_pdf !== false)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  if (checklist.length > 0) {
    sectionTitle('Checklist');
    checklist.forEach((c) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      if (c.response_type === 'text') {
        const lines = doc.splitTextToSize(`${c.title}: ${c.answer?.trim() || '—'}`, maxWidth);
        ensureSpace(lines.length * 5 + 2);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 1;
      } else {
        ensureSpace(7);
        const mark = c.is_done ? '[X]' : '[ ]';
        doc.text(`${mark}  ${c.title}`, margin, y);
        y += 6;
      }
    });
    y += 2;
  }

  // Encerramento
  if (order.is_closed || order.execution_summary || order.signature_url || (order.close_attachments || []).length) {
    sectionTitle('Encerramento da ordem');
    paragraph('Como foi a execução', order.execution_summary);
    fieldPair(
      ['Início da execução', formatDateTime(order.execution_starts_at)],
      ['Fim da execução', formatDateTime(order.execution_ends_at)]
    );
    if (order.closed_at) {
      fieldPair(
        ['Encerrada em', formatDateTime(order.closed_at)],
        ['Encerrada por', order.closed_by_name || '—']
      );
    }

    const photos = order.close_attachments || [];
    if (photos.length > 0) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('FOTOS / ANEXOS', margin, y);
      y += 4;

      for (const url of photos) {
        try {
          const img = await loadImageForBudgetPdf(url);
          if (!img) continue;
          const box = fitImageInBox(img.naturalW, img.naturalH, maxWidth, 55);
          ensureSpace(box.h + 6);
          doc.addImage(img.dataUrl, img.format, margin, y, box.w, box.h);
          y += box.h + 4;
        } catch (err) {
          console.warn('Falha ao embutir anexo no PDF:', err);
        }
      }
    }

    if (order.signature_url) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('ASSINATURA', margin, y);
      y += 3;
      try {
        const img = await loadImageForBudgetPdf(order.signature_url);
        if (img) {
          const box = fitImageInBox(img.naturalW, img.naturalH, 80, 30);
          ensureSpace(box.h + 4);
          doc.addImage(img.dataUrl, img.format, margin, y, box.w, box.h);
          y += box.h + 4;
        }
      } catch (err) {
        console.warn('Falha ao embutir assinatura no PDF:', err);
        y += 4;
      }
    }
  } else {
    // Assinaturas em branco (OS aberta)
    ensureSpace(40);
    y += 8;
    doc.setDrawColor(148, 163, 184);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do responsável', margin, y);
    doc.text('Assinatura do cliente', pageWidth - margin - 70, y);
  }

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Documento gerado automaticamente • OS ${order.code} • ${formatDate(order.created_at)}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc.output('blob');
}

/** Baixa o PDF no navegador */
export function downloadServiceOrderPDF(blob: Blob, code: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordem-servico-${code}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Abre o PDF em nova aba */
export function openServiceOrderPDF(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
