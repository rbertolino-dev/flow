import { test, expect } from '@playwright/test';
import {
  OFX_MAX_TRANSACTIONS,
  defaultOfxDescription,
  hashFile,
  parseOfxContent,
  parseOfxFile,
} from '../../src/lib/ofxParser';

const ASAAS_SAMPLE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>461
<ACCTID>123456
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250701000000
<DTEND>20250731000000
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250707000000
<TRNAMT>160.00
<FITID>1340718177
<MEMO>Cobranca recebida - fatura nr 123
</STMTTRN>
<STMTTRN>
<TRNTYPE>FEE
<DTPOSTED>20250707000000
<TRNAMT>-1.99
<FITID>1340718178
<MEMO>Taxa Pix
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250701000000
<TRNAMT>-389.15
<FITID>1334928309
<MEMO>Pagamento de conta - Pos HO
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

function buildManyTransactions(count: number): string {
  const rows = Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    return `<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>202507${day}000000
<TRNAMT>10.00
<FITID>FIT-${index + 1}
<MEMO>Lancamento ${index + 1}
</STMTTRN>`;
  }).join('\n');
  return `<OFX><BANKTRANLIST>
<DTSTART>20250701000000
<DTEND>20250731000000
${rows}
</BANKTRANLIST></OFX>`;
}

test.describe('@unit ofxParser', () => {
  test('lê extrato Asaas SGML com crédito, taxa e débito', () => {
    const result = parseOfxContent(ASAAS_SAMPLE);
    expect(result.periodStart).toBe('2025-07-01');
    expect(result.periodEnd).toBe('2025-07-31');
    expect(result.bankId).toBe('461');
    expect(result.accountId).toBe('123456');
    expect(result.transactions).toHaveLength(3);

    expect(result.transactions[0]).toMatchObject({
      fitId: '1334928309',
      trnType: 'DEBIT',
      postedAt: '2025-07-01',
      amount: 389.15,
      direction: 'pagar',
      memo: 'Pagamento de conta - Pos HO',
      rawAmount: -389.15,
    });
    expect(result.transactions[1]).toMatchObject({
      fitId: '1340718177',
      direction: 'receber',
      amount: 160,
      memo: 'Cobranca recebida - fatura nr 123',
    });
    expect(result.transactions[2]).toMatchObject({
      fitId: '1340718178',
      trnType: 'FEE',
      direction: 'pagar',
      amount: 1.99,
      memo: 'Taxa Pix',
    });
  });

  test('ignora FITID duplicado no mesmo arquivo', () => {
    const content = `<OFX><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250710000000
<TRNAMT>50.00
<FITID>DUP-1
<MEMO>Primeiro
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250711000000
<TRNAMT>80.00
<FITID>DUP-1
<MEMO>Duplicado
</STMTTRN>
</BANKTRANLIST></OFX>`;
    const result = parseOfxContent(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].memo).toBe('Primeiro');
  });

  test('gera fingerprint quando FITID está ausente', () => {
    const content = `<OFX><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250715000000
<TRNAMT>-25.50
<MEMO>Sem FITID
</STMTTRN>
</BANKTRANLIST></OFX>`;
    const result = parseOfxContent(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].fitId).toMatch(/^fp-\d+-20250715$/);
    expect(result.transactions[0].amount).toBeCloseTo(25.5);
    expect(result.transactions[0].direction).toBe('pagar');
  });

  test('aceita valor com vírgula decimal e tags XML fechadas', () => {
    const content = `<?xml version="1.0"?>
<OFX>
  <BANKTRANLIST>
    <STMTTRN>
      <TRNTYPE>CREDIT</TRNTYPE>
      <DTPOSTED>20250801</DTPOSTED>
      <TRNAMT>1234,56</TRNAMT>
      <FITID>XML-1</FITID>
      <NAME>Cliente Exemplo</NAME>
      <MEMO>Recebimento PIX</MEMO>
    </STMTTRN>
  </BANKTRANLIST>
</OFX>`;
    const result = parseOfxContent(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBeCloseTo(1234.56);
    expect(result.transactions[0].payeeName).toBe('Cliente Exemplo');
    expect(result.transactions[0].direction).toBe('receber');
  });

  test('rejeita arquivo sem lançamentos', () => {
    expect(() => parseOfxContent('<OFX><BANKTRANLIST></BANKTRANLIST></OFX>')).toThrow(
      /Nenhum lançamento encontrado/,
    );
  });

  test(`rejeita mais de ${OFX_MAX_TRANSACTIONS} lançamentos`, () => {
    expect(() => parseOfxContent(buildManyTransactions(OFX_MAX_TRANSACTIONS + 1))).toThrow(
      /limite é de até 100/,
    );
    const ok = parseOfxContent(buildManyTransactions(OFX_MAX_TRANSACTIONS));
    expect(ok.transactions).toHaveLength(OFX_MAX_TRANSACTIONS);
  });

  test('monta descrição padrão do lançamento', () => {
    const description = defaultOfxDescription({
      fitId: '1',
      trnType: 'CREDIT',
      postedAt: '2025-07-07',
      amount: 160,
      direction: 'receber',
      memo: 'Cobranca recebida',
      payeeName: '',
      rawAmount: 160,
    });
    expect(description).toContain('Cobranca recebida');
    expect(description).toContain('07/07/2025');
    expect(description).toMatch(/R\$\s*160/);
  });

  test('parseOfxFile lê .ofx e rejeita extensão inválida', async () => {
    const file = new File([ASAAS_SAMPLE], 'Extrato Asaas (2).ofx', { type: 'application/x-ofx' });
    const result = await parseOfxFile(file);
    expect(result.transactions).toHaveLength(3);
    expect(result.bankId).toBe('461');

    const qfx = new File([ASAAS_SAMPLE], 'extrato.qfx', { type: 'application/vnd.intu.qfx' });
    await expect(parseOfxFile(qfx)).resolves.toMatchObject({ accountId: '123456' });

    await expect(parseOfxFile(new File(['x'], 'extrato.txt'))).rejects.toThrow(/formato OFX/);
  });

  test('hashFile gera digest estável para o mesmo conteúdo', async () => {
    const a = new File([ASAAS_SAMPLE], 'a.ofx');
    const b = new File([ASAAS_SAMPLE], 'b.ofx');
    const ha = await hashFile(a);
    const hb = await hashFile(b);
    expect(ha).toBe(hb);
    expect(ha.length).toBeGreaterThan(10);
  });
});
