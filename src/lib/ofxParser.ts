import type { FinanceDirection } from '@/lib/finance';

/** Limite prático por importação (extratos Asaas mensais costumam passar de 100). */
export const OFX_MAX_TRANSACTIONS = 500;

export interface OfxTransaction {
  fitId: string;
  trnType: string;
  postedAt: string;
  amount: number;
  direction: FinanceDirection;
  memo: string;
  payeeName: string;
  rawAmount: number;
}

export interface OfxParseResult {
  transactions: OfxTransaction[];
  periodStart: string | null;
  periodEnd: string | null;
  bankId: string | null;
  accountId: string | null;
}

const CREDIT_TYPES = new Set([
  'CREDIT', 'DEP', 'DEPOSIT', 'DIRECTDEP', 'DIV', 'INT', 'XFER',
]);

const DEBIT_TYPES = new Set([
  'DEBIT', 'PAYMENT', 'CHECK', 'ATM', 'POS', 'FEE', 'SRVCHG', 'CASH', 'REPEATPMT',
]);

function decodeOfxText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hasHigh = false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] >= 0x80) {
      hasHigh = true;
      break;
    }
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!hasHigh || !utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
  try {
    return new TextDecoder('windows-1252', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return utf8.replace(/^\uFEFF/, '');
  }
}

function tagValue(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = block.match(re);
  return (match?.[1] || '').trim();
}

function parseOfxDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function resolveDirection(trnType: string, amount: number): FinanceDirection {
  const type = trnType.toUpperCase();
  if (amount < 0) return 'pagar';
  if (amount > 0) return 'receber';
  if (DEBIT_TYPES.has(type)) return 'pagar';
  if (CREDIT_TYPES.has(type)) return 'receber';
  return 'pagar';
}

function fingerprint(postedAt: string, amount: number, memo: string): string {
  const base = `${postedAt}|${amount.toFixed(2)}|${memo.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return `fp-${Math.abs(hash)}-${postedAt.replace(/-/g, '')}`;
}

function extractStmtBlocks(content: string): string[] {
  const blocks: string[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/?BANKTRANLIST)|(?=<\/?STMTRS)|$)/gi;
  let match = re.exec(content);
  while (match) {
    blocks.push(match[1] || '');
    match = re.exec(content);
  }
  if (blocks.length > 0) return blocks;
  // Fallback: split by opening tags when closing tags are missing
  const parts = content.split(/<STMTTRN>/i).slice(1);
  return parts.map((part) => part.split(/<\/STMTTRN>/i)[0] || part);
}

export function parseOfxContent(content: string): OfxParseResult {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const bodyStart = normalized.search(/<OFX>/i);
  const body = bodyStart >= 0 ? normalized.slice(bodyStart) : normalized;

  const periodStart = parseOfxDate(tagValue(body, 'DTSTART'));
  const periodEnd = parseOfxDate(tagValue(body, 'DTEND'));
  const bankId = tagValue(body, 'BANKID') || null;
  const accountId = tagValue(body, 'ACCTID') || null;

  const seen = new Set<string>();
  const transactions: OfxTransaction[] = [];

  for (const block of extractStmtBlocks(body)) {
    const trnType = tagValue(block, 'TRNTYPE') || 'OTHER';
    const postedAt = parseOfxDate(tagValue(block, 'DTPOSTED'));
    const rawAmount = parseAmount(tagValue(block, 'TRNAMT'));
    if (!postedAt || !Number.isFinite(rawAmount) || rawAmount === 0) continue;

    const memo = tagValue(block, 'MEMO') || tagValue(block, 'NAME') || '';
    const payeeName = tagValue(block, 'NAME') || tagValue(block, 'PAYEE') || '';
    const fitRaw = tagValue(block, 'FITID');
    const fitId = fitRaw || fingerprint(postedAt, Math.abs(rawAmount), memo || payeeName);
    if (seen.has(fitId)) continue;
    seen.add(fitId);

    const direction = resolveDirection(trnType, rawAmount);
    transactions.push({
      fitId,
      trnType,
      postedAt,
      amount: Math.abs(rawAmount),
      direction,
      memo,
      payeeName,
      rawAmount,
    });
  }

  if (transactions.length === 0) {
    throw new Error('Nenhum lançamento encontrado no arquivo OFX');
  }
  if (transactions.length > OFX_MAX_TRANSACTIONS) {
    throw new Error(
      `Este arquivo tem ${transactions.length} lançamentos. O limite é de até ${OFX_MAX_TRANSACTIONS} por visualização. Exporte o OFX em um período menor e tente novamente.`,
    );
  }

  transactions.sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  return {
    transactions,
    periodStart: periodStart || transactions[0]?.postedAt || null,
    periodEnd: periodEnd || transactions[transactions.length - 1]?.postedAt || null,
    bankId,
    accountId,
  };
}

export async function parseOfxFile(file: File): Promise<OfxParseResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.ofx') && !name.endsWith('.qfx')) {
    throw new Error('Envie um arquivo no formato OFX');
  }
  const buffer = await file.arrayBuffer();
  return parseOfxContent(decodeOfxText(buffer));
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    hash = ((hash << 5) - hash) + bytes[i];
    hash |= 0;
  }
  return `legacy-${Math.abs(hash)}-${file.size}`;
}

export function defaultOfxDescription(tx: OfxTransaction): string {
  const label = tx.memo || tx.payeeName || tx.trnType || 'Lançamento OFX';
  const money = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [year, month, day] = tx.postedAt.split('-');
  const date = year && month && day ? `${day}/${month}/${year}` : tx.postedAt;
  return `${money} - ${label} - ${date}`;
}
