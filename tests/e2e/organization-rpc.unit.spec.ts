import { test, expect } from "@playwright/test";
import { extractOrganizationIdFromRpc } from "../../src/lib/extractOrganizationIdFromRpc";

test.describe("extractOrganizationIdFromRpc", () => {
  test("aceita uuid string", () => {
    expect(extractOrganizationIdFromRpc("913659bf-cec9-49ad-b7f5-cc74c079516d")).toBe(
      "913659bf-cec9-49ad-b7f5-cc74c079516d"
    );
  });

  test("aceita payload JSON da RPC em produção", () => {
    expect(
      extractOrganizationIdFromRpc({
        success: true,
        organization_id: "913659bf-cec9-49ad-b7f5-cc74c079516d",
        message: "Organização criada com sucesso",
      })
    ).toBe("913659bf-cec9-49ad-b7f5-cc74c079516d");
  });

  test("retorna null para dados inválidos", () => {
    expect(extractOrganizationIdFromRpc(null)).toBeNull();
    expect(extractOrganizationIdFromRpc({})).toBeNull();
    expect(extractOrganizationIdFromRpc("")).toBeNull();
  });
});
