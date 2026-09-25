import { test, expect } from "@playwright/test";
import { findProductByName, parseNfeXml } from "../../src/lib/nfeXml";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <ide>
        <nNF>1635</nNF>
        <dhEmi>2026-09-01T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Malharia Exemplo LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>1002</cProd>
          <xProd>Camiseta tricot slim premium</xProd>
          <NCM>62046900</NCM>
          <uCom>UN</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>29.95</vUnCom>
          <vProd>149.75</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>3003</cProd>
          <xProd>Camiseta G. Polo Texturizada</xProd>
          <NCM>62046900</NCM>
          <uCom>UN</uCom>
          <qCom>6.0000</qCom>
          <vUnCom>37.45</vUnCom>
          <vProd>224.70</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>374.45</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

test.describe("@unit nfeXml", () => {
  test("lê fornecedor, total e dois itens da NF-e", async ({ page }) => {
    await page.setContent("<!DOCTYPE html><html><body></body></html>");
    const invoice = await page.evaluate(parseNfeXml, SAMPLE_XML);
    expect(invoice).not.toBeNull();
    expect(invoice?.number).toBe("1635");
    expect(invoice?.supplierName).toBe("Malharia Exemplo LTDA");
    expect(invoice?.supplierDocument).toBe("12345678000199");
    expect(invoice?.total).toBeCloseTo(374.45);
    expect(invoice?.items).toHaveLength(2);
    expect(invoice?.items[0]).toMatchObject({
      name: "Camiseta tricot slim premium",
      code: "1002",
      ncm: "62046900",
      unit: "UN",
      quantity: 5,
      unitPrice: 29.95,
      subtotal: 149.75,
    });
    expect(invoice?.items[1].name).toBe("Camiseta G. Polo Texturizada");
    expect(invoice?.items[1].quantity).toBe(6);
  });

  test("associa produto pelo nome ignorando maiúsculas e espaços", () => {
    const products = [
      { id: "1", name: "  Camiseta   Tricot slim premium " },
      { id: "2", name: "Outro produto" },
    ];
    expect(findProductByName(products, "camiseta tricot slim premium")?.id).toBe("1");
    expect(findProductByName(products, "Produto inexistente")).toBeNull();
  });
});
