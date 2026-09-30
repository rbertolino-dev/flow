import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ServiceOrder,
  ServiceOrderTemplateField,
  fieldsForSlip,
  normalizeSlipConfig,
  normalizeTableConfig,
  sectionTitleForSlip,
} from '@/types/serviceOrder';
import { organizationNameForDocuments } from '@/lib/organizationDisplayName';

export interface ThreeSlipPdfOptions {
  order: ServiceOrder;
  organizationName?: string;
  organizationData?: {
    name?: string | null;
    company_profile?: string | null;
    logo_url?: string | null;
  } | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
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

function fieldText(order: ServiceOrder, field: ServiceOrderTemplateField): string {
  const key = field.field_key;
  const custom = order.custom_fields || {};
  if (key === 'lead_id') {
    return asText(order.client_name || order.lead?.name);
  }
  if (key === 'order_total') {
    const raw = custom.order_total;
    const amount = raw === null || raw === undefined || raw === '' ? Number(order.total || 0) : Number(raw);
    return formatCurrency(Number.isFinite(amount) ? amount : 0);
  }
  if (field.field_type === 'date' || field.field_type === 'datetime') {
    return formatDate(typeof custom[key] === 'string' ? (custom[key] as string) : null);
  }
  return asText(custom[key]);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [37, 99, 235];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export async function generateThreeSlipPDF(options: ThreeSlipPdfOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const order = options.order;
  const template = order.template;
  const slips = normalizeSlipConfig(template?.slip_config);
  const bandHeight = 99;
  const margin = 8;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const orgName =
    options.organizationName ||
    organizationNameForDocuments(options.organizationData) ||
    '';

  slips.forEach((slip, index) => {
    const top = index * bandHeight;
    const slipNumber = index + 1;
    const footerReserve = slip.footer === 'none' ? 4 : 12;
    const maxY = top + bandHeight - footerReserve;
    let y = top + 6;
    const color = hexToRgb(slip.color);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(slip.label.toUpperCase(), margin, y);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(order.code || '', pageWidth - margin, y, { align: 'right' });
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const issued = formatDate(order.created_at);
    const subtitle = [slip.subtitle, issued !== '—' ? `Emissão: ${issued}` : ''].filter(Boolean).join('  ·  ');
    if (subtitle) {
      doc.text(subtitle, margin, y);
      y += 4;
    }
    if (orgName) {
      doc.setFontSize(7.5);
      doc.text(orgName, margin, y);
      y += 4;
    }

    const fields = template ? fieldsForSlip(template, slipNumber) : [];
    const groups: Array<{ title: string; fields: ServiceOrderTemplateField[] }> = [];
    for (const field of fields) {
      const title = sectionTitleForSlip(field, String(slipNumber));
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.fields.push(field);
      else groups.push({ title, fields: [field] });
    }

    for (const group of groups) {
      if (y > maxY - 8) break;
      if (group.title) {
        y += 1.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(group.title.toUpperCase(), margin, y);
        y += 3.5;
      }

      const textFields = group.fields.filter((field) => field.field_type !== 'table');
      const tables = group.fields.filter((field) => field.field_type === 'table');

      for (let i = 0; i < textFields.length; i += 2) {
        if (y > maxY - 4) break;
        const left = textFields[i];
        const right = textFields[i + 1];
        const colW = contentWidth / 2;
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.text(`${left.label}:`, margin, y);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        const leftValue = fieldText(order, left);
        doc.text(leftValue, margin + 28, y, { maxWidth: colW - 30 });
        if (right) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(`${right.label}:`, margin + colW, y);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.text(fieldText(order, right), margin + colW + 28, y, { maxWidth: colW - 30 });
        }
        y += 4.2;
      }

      for (const tableField of tables) {
        if (y > maxY - 16) break;
        const config = normalizeTableConfig(tableField.table_config);
        const stored = (order.custom_fields || {})[tableField.field_key];
        const grid = stored && typeof stored === 'object' ? (stored as Record<string, Record<string, string>>) : {};
        const labelW = 16;
        const colW = (contentWidth - labelW) / Math.max(config.columns.length, 1);
        const rowH = 6;

        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, contentWidth, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('Olho', margin + 1, y + 4);
        config.columns.forEach((col, colIndex) => {
          doc.text(col.label, margin + labelW + colIndex * colW + 1, y + 4);
        });
        y += rowH;

        for (const row of config.rows) {
          if (y > maxY - 6) break;
          const rowColor = hexToRgb(row.color || '#334155');
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, contentWidth, rowH);
          doc.setTextColor(rowColor[0], rowColor[1], rowColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text(row.label, margin + 1, y + 4);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'normal');
          const cells = grid[row.key] || {};
          config.columns.forEach((col, colIndex) => {
            const value = cells[col.key];
            doc.text(value ? String(value) : '—', margin + labelW + colIndex * colW + 1, y + 4);
          });
          y += rowH;
        }
        y += 2;
      }
    }

    const footerY = top + bandHeight - 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    if (slip.footer === 'signature') {
      doc.line(margin, footerY - 1, margin + 70, footerY - 1);
      doc.text('Assinatura do responsável', margin, footerY + 3);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(Number(order.total || 0)), pageWidth - margin, footerY + 3, { align: 'right' });
    } else if (slip.footer === 'received') {
      doc.text('Recebido por: ____________________', margin, footerY);
      doc.text('Data: ____/____/________', margin + 90, footerY);
    }

    if (index < slips.length - 1) {
      const cutY = top + bandHeight;
      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(6, cutY, pageWidth - 6, cutY);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('RECORTAR AQUI', pageWidth / 2, cutY - 1.2, { align: 'center' });
    }
  });

  return doc.output('blob');
}
