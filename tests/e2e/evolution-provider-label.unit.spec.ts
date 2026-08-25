import { test, expect } from "@playwright/test";
import {
  evolutionProviderLabel,
  fallbackEvolutionLabel,
  matchEvolutionProvider,
} from "../../src/lib/evolutionProvider";

test.describe("@unit tag de provider Evolution", () => {
  const providers = [
    {
      provider_id: "p30",
      provider_name: "evo 30",
      api_url: "https://evo30.atendimentoagilize.com/manager",
    },
    {
      provider_id: "pos",
      provider_name: "api.ordemservico",
      api_url: "https://api.ordemservico.com",
    },
  ];

  test("casa URL da instância com a Evo habilitada mesmo com /manager", () => {
    const match = matchEvolutionProvider("https://evo30.atendimentoagilize.com", providers);
    expect(match?.provider_name).toBe("evo 30");
  });

  test("casa ordem de serviço pelo host", () => {
    const match = matchEvolutionProvider("https://api.ordemservico.com/", providers);
    expect(match?.provider_name).toBe("api.ordemservico");
  });

  test("usa fallback do hostname quando a Evo não está na lista", () => {
    expect(fallbackEvolutionLabel("https://evo20.atendimentoagilize.com")).toBe("evo 20");
    expect(fallbackEvolutionLabel("https://api.ordemservico.com")).toBe("api.ordemservico");
  });

  test("label prefere o nome cadastrado do provider", () => {
    expect(
      evolutionProviderLabel("https://evo30.atendimentoagilize.com", providers),
    ).toBe("evo 30");
  });

  test("label prefere o evolution_provider_id gravado", () => {
    expect(
      evolutionProviderLabel(
        "https://api.ordemservico.com",
        providers,
        null,
        "p30",
      ),
    ).toBe("evo 30");
  });
});
