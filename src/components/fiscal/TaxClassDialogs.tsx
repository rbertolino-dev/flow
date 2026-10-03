import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

async function fiscalCall(orgId: string, action: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiscal-invoice?action=${action}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session?.access_token || ""}`,
      "Content-Type": "application/json",
      "X-Organization-Id": orgId,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha na classe de imposto");
  return data;
}

export type ClassScenario = {
  tax: string;
  name: string;
  person: string;
  cfop: string;
  cst: string;
  rate: string;
  tipo: string;
  classificacao: string;
  codigo_enquadramento: string;
  aliquota_credito: string;
  aliquota_reducao: string;
  aliquota_mva: { estado?: string; aliquota?: string }[];
  beneficio_fiscal: { estado?: string; codigo?: string }[];
  credito_presumido: { estado?: string; codigo_beneficio_fiscal?: string; aliquota?: string }[];
};

export type FiscalClass = {
  ref: string;
  description: string;
  noteType: string;
  icms: ClassScenario[];
  ipi: ClassScenario[];
  pis: ClassScenario[];
  cofins: ClassScenario[];
  ibs: ClassScenario[];
  service: {
    codigo_servico: string;
    natureza_operacao: string;
    exigibilidade_iss: string;
    iss_retido: string;
    responsavel_retencao: string;
    iss: string;
    pis: string;
    cofins: string;
    inss: string;
    ir: string;
    csll: string;
    situacao_tributaria: string;
    classificacao_tributaria: string;
  } | null;
};

type Toast = (opts: { title: string; variant?: "destructive" }) => void;
type UfRow = { estado: string; aliquota: string; codigo: string };
type IcmsCard = {
  cenario: string;
  tipo_pessoa: string;
  situacao_tributaria: string;
  codigo_cfop: string;
  tipo_tributacao: string;
  aliquota_credito: string;
  aliquota_reducao: string;
  mva: UfRow[];
  beneficio: UfRow[];
  credito: UfRow[];
};
type ManualRow = IcmsCard & { tax: string; aliquota: string; classificacao_tributaria: string; codigo_enquadramento: string };

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const CENARIOS = [
  { value: "padrao", label: "Padrão" },
  { value: "saida_dentro_estado", label: "Saída dentro do estado" },
  { value: "saida_fora_estado", label: "Saída fora do estado" },
  { value: "entrada_dentro_estado", label: "Entrada dentro do estado" },
  { value: "entrada_fora_estado", label: "Entrada fora do estado" },
];
const CSOSN = [
  ["101", "101 - Tributada com permissão de crédito"],
  ["102", "102 - Tributada sem permissão de crédito"],
  ["103", "103 - Isenção do ICMS para faixa de receita bruta"],
  ["201", "201 - Tributada com permissão de crédito e com cobrança do ICMS por substituição tributária"],
  ["202", "202 - Tributada sem permissão de crédito e com cobrança do ICMS por substituição tributária"],
  ["203", "203 - Isenção do ICMS para faixa de receita bruta e com cobrança do ICMS por substituição tributária"],
  ["300", "300 - Imune"],
  ["400", "400 - Não tributada"],
  ["500", "500 - ICMS cobrado anteriormente por substituição tributária"],
  ["900", "900 - Outros"],
];
const CST_NORMAL = [
  ["00", "00 - Tributada integralmente"],
  ["10", "10 - Tributada e com cobrança do ICMS por substituição tributária"],
  ["20", "20 - Com redução da base de cálculo"],
  ["30", "30 - Isenta ou não tributada e com cobrança do ICMS por substituição tributária"],
  ["40", "40 - Isenta"],
  ["41", "41 - Não tributada"],
  ["50", "50 - Suspensão"],
  ["51", "51 - Diferimento"],
  ["60", "60 - ICMS cobrado anteriormente por substituição tributária"],
  ["70", "70 - Com redução de base de cálculo e cobrança do ICMS por substituição tributária"],
  ["90", "90 - Outros"],
];
const IPI = [["00", "00"], ["01", "01"], ["02", "02"], ["03", "03"], ["04", "04"], ["05", "05"], ["49", "49"], ["50", "50"], ["51", "51"], ["52", "52"], ["53", "53"], ["54", "54"], ["55", "55"], ["99", "99"]];
const PIS = ["01", "02", "04", "05", "06", "07", "08", "09", "49", "50", "70", "98", "99"].map((code) => [code, code]);

function emptyCard(cenario: string, pessoa: string, cfop: string): IcmsCard {
  return {
    cenario, tipo_pessoa: pessoa, situacao_tributaria: "102", codigo_cfop: cfop, tipo_tributacao: "simples_nacional",
    aliquota_credito: "", aliquota_reducao: "", mva: [], beneficio: [], credito: [],
  };
}

function defaultSimples() {
  return [
    emptyCard("saida_dentro_estado", "juridica", "5102"),
    emptyCard("saida_fora_estado", "juridica", "6102"),
    emptyCard("saida_dentro_estado", "fisica", "5102"),
    emptyCard("saida_fora_estado", "fisica", "6102"),
  ];
}

function labelOf(options: { value: string; label: string }[], value: string) {
  return options.find((item) => item.value === value)?.label || value || "—";
}

function extrasFrom(row: ClassScenario): Pick<IcmsCard, "aliquota_reducao" | "mva" | "beneficio" | "credito" | "aliquota_credito"> {
  return {
    aliquota_credito: row.aliquota_credito || "",
    aliquota_reducao: row.aliquota_reducao || "",
    mva: (row.aliquota_mva || []).map((item) => ({ estado: item.estado || "", aliquota: String(item.aliquota || ""), codigo: "" })),
    beneficio: (row.beneficio_fiscal || []).map((item) => ({ estado: item.estado || "", aliquota: "", codigo: item.codigo || "" })),
    credito: (row.credito_presumido || []).map((item) => ({ estado: item.estado || "", aliquota: String(item.aliquota || ""), codigo: item.codigo_beneficio_fiscal || "" })),
  };
}

function payloadExtras(card: IcmsCard) {
  return {
    aliquota_credito: card.aliquota_credito,
    aliquota_reducao: card.aliquota_reducao,
    aliquota_mva: card.mva.filter((row) => row.estado && row.aliquota).map((row) => ({ estado: row.estado, aliquota: row.aliquota })),
    beneficio_fiscal: card.beneficio.filter((row) => row.estado && row.codigo).map((row) => ({ estado: row.estado, codigo: row.codigo })),
    credito_presumido: card.credito.filter((row) => row.estado && row.codigo).map((row) => ({ estado: row.estado, codigo_beneficio_fiscal: row.codigo, aliquota: row.aliquota || "0" })),
  };
}

function Extras({ card, onChange }: { card: IcmsCard; onChange: (next: IcmsCard) => void }) {
  function add(key: "mva" | "beneficio" | "credito") {
    onChange({ ...card, [key]: [...card[key], { estado: "PA", aliquota: "", codigo: "" }] });
  }
  function edit(key: "mva" | "beneficio" | "credito", index: number, patch: Partial<UfRow>) {
    onChange({ ...card, [key]: card[key].map((row, i) => i === index ? { ...row, ...patch } : row) });
  }
  return (
    <div className="mt-2 space-y-2 rounded bg-white/70 p-2 text-xs">
      <p className="font-medium">Complementos do ICMS</p>
      <div><p>Redução da base</p><Input className="h-8" value={card.aliquota_reducao} onChange={(event) => onChange({ ...card, aliquota_reducao: event.target.value })} /></div>
      <UfList title="MVA" rows={card.mva} amount onAdd={() => add("mva")} onEdit={(index, patch) => edit("mva", index, patch)} />
      <UfList title="Benefício fiscal" rows={card.beneficio} onAdd={() => add("beneficio")} onEdit={(index, patch) => edit("beneficio", index, patch)} />
      <UfList title="Crédito presumido" rows={card.credito} amount onAdd={() => add("credito")} onEdit={(index, patch) => edit("credito", index, patch)} />
    </div>
  );
}

function UfList({ title, rows, amount, onAdd, onEdit }: { title: string; rows: UfRow[]; amount?: boolean; onAdd: () => void; onEdit: (index: number, patch: Partial<UfRow>) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><span>{title}</span><Button type="button" variant="outline" className="h-7" onClick={onAdd}>Adicionar UF</Button></div>
      {rows.map((row, index) => (
        <div key={`${title}-${index}`} className="mb-1 grid grid-cols-2 gap-1">
          <Select value={row.estado || "PA"} onValueChange={(value) => onEdit(index, { estado: value })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select>
          <Input className="h-8" placeholder={amount ? "Alíquota" : "Código"} value={amount ? row.aliquota : row.codigo} onChange={(event) => onEdit(index, amount ? { aliquota: event.target.value } : { codigo: event.target.value })} />
          {amount && title !== "MVA" ? <Input className="col-span-2 h-8" placeholder="Código" value={row.codigo} onChange={(event) => onEdit(index, { codigo: event.target.value })} /> : null}
        </div>
      ))}
    </div>
  );
}

export function TaxClassDialogs({ orgId, which, classes, onClose, onSaved, toast }: {
  orgId: string;
  which: "product" | "service" | null;
  classes: FiscalClass[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: Toast;
}) {
  const [step, setStep] = useState<"choice" | "simples" | "manual" | "service" | null>(null);
  const [saving, setSaving] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [nome, setNome] = useState("");
  const [cards, setCards] = useState<IcmsCard[]>(defaultSimples());
  const [tab, setTab] = useState("icms");
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [draft, setDraft] = useState<ManualRow>({ ...emptyCard("saida_dentro_estado", "fisica", "5102"), tax: "icms", aliquota: "0", classificacao_tributaria: "", codigo_enquadramento: "999" });
  const [removeRef, setRemoveRef] = useState("");
  const [service, setService] = useState({ codigo_servico: "", natureza_operacao: "1", exigibilidade_iss: "1", iss_retido: "2", responsavel_retencao: "1", iss: "0", pis: "0", cofins: "0", inss: "0", ir: "0", csll: "0", situacao_tributaria: "", classificacao_tributaria: "" });

  const productClasses = classes.filter((item) => item.noteType !== "nfse" && item.ref);
  const serviceClasses = classes.filter((item) => item.noteType === "nfse" && item.ref);
  const visible = which === "service" ? serviceClasses : productClasses;

  function resetCreate() {
    setReferencia("");
    setNome("");
    setCards(defaultSimples());
    setRows([]);
    setService({ codigo_servico: "", natureza_operacao: "1", exigibilidade_iss: "1", iss_retido: "2", responsavel_retencao: "1", iss: "0", pis: "0", cofins: "0", inss: "0", ir: "0", csll: "0", situacao_tributaria: "", classificacao_tributaria: "" });
  }

  function editProduct(item: FiscalClass) {
    setReferencia(item.ref);
    setNome(item.description);
    const simples = item.icms.length > 0 && item.icms.every((row) => row.tipo === "simples_nacional" && row.name.startsWith("saida_"));
    if (simples) {
      const next = defaultSimples().map((card) => {
        const found = item.icms.find((row) => row.name === card.cenario && row.person === card.tipo_pessoa);
        return found ? { ...card, situacao_tributaria: found.cst || "102", codigo_cfop: found.cfop || card.codigo_cfop, ...extrasFrom(found) } : card;
      });
      setCards(next);
      setStep("simples");
      return;
    }
    const blocks = [
      ...item.icms.map((row) => ["icms", row] as const),
      ...item.ipi.map((row) => ["ipi", row] as const),
      ...item.pis.map((row) => ["pis", row] as const),
      ...item.cofins.map((row) => ["cofins", row] as const),
      ...item.ibs.map((row) => ["ibs_cbs", row] as const),
    ];
    setRows(blocks.map(([tax, row]) => ({
      ...emptyCard(row.name || "saida_dentro_estado", row.person || "fisica", row.cfop || ""),
      tax,
      situacao_tributaria: row.cst,
      tipo_tributacao: row.tipo || "simples_nacional",
      aliquota: row.rate || "0",
      classificacao_tributaria: row.classificacao || "",
      codigo_enquadramento: row.codigo_enquadramento || "999",
      ...extrasFrom(row),
    })));
    setStep("manual");
  }

  function editService(item: FiscalClass) {
    setReferencia(item.ref);
    setNome(item.description);
    setService({ ...(item.service || service), codigo_servico: item.service?.codigo_servico || "" });
    setStep("service");
  }

  async function save(body: Record<string, unknown>) {
    if (!orgId) return;
    setSaving(true);
    try {
      const data = await fiscalCall(orgId, "classes", { method: "POST", body: JSON.stringify(body) });
      toast({ title: data.bubbleWarning || "Classe salva na empresa" });
      setStep(null);
      resetCreate();
      await onSaved();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Não foi possível salvar a classe", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function addManual() {
    const count = rows.filter((row) => row.tax === draft.tax).length;
    if (count >= 4) {
      toast({ title: "Cada imposto aceita até 4 cenários", variant: "destructive" });
      return;
    }
    if (draft.tax === "icms" && draft.cenario === "padrao") {
      toast({ title: "ICMS não usa o cenário padrão", variant: "destructive" });
      return;
    }
    if (draft.tax === "ibs_cbs" && !/^\d{6}$/.test(draft.classificacao_tributaria)) {
      toast({ title: "A classificação tributária do IBS/CBS tem 6 dígitos", variant: "destructive" });
      return;
    }
    setRows([...rows, draft]);
  }

  const cstOptions = draft.tipo_tributacao === "tributacao_normal" ? CST_NORMAL : CSOSN;

  return (
    <>
      <Dialog open={which !== null} onOpenChange={(open) => { if (!open) { onClose(); setStep(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              <span>{which === "service" ? "Minhas classes de imposto para serviço" : "Minhas Classes de Impostos para Produto"}</span>
              <Button onClick={() => { resetCreate(); setStep(which === "service" ? "service" : "choice"); }}>{which === "service" ? "Nova classe" : "Nova Classe"}</Button>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-auto">
            {!visible.length ? <p className="text-sm text-slate-500">Nenhuma classe nesta empresa.</p> : null}
            {visible.map((item) => {
              const groups = { icms: item.icms, ipi: item.ipi, pis: item.pis, cofins: item.cofins, ibs: item.ibs };
              const current = groups[tab as keyof typeof groups] || [];
              return (
                <div key={item.ref} className="rounded border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-medium uppercase">{item.description || item.ref}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => which === "service" ? editService(item) : editProduct(item)}>Editar Classe</Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir classe" onClick={() => setRemoveRef(item.ref)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </div>
                  {which === "product" ? (
                    <>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {[["icms", "ICMS"], ["ipi", "IPI"], ["pis", "PIS"], ["cofins", "COFINS"], ["ibs", "CBS/IBS"]].map(([key, label]) => (
                          <button key={key} className={`rounded-t px-3 py-1 text-xs text-white ${tab === key ? "bg-blue-800" : "bg-blue-600"}`} onClick={() => setTab(key)}>{label}</button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {(current.length ? current : []).map((row, index) => (
                          <div key={`${item.ref}-${index}`} className="grid grid-cols-2 gap-2 rounded bg-slate-100 p-2 text-xs md:grid-cols-5">
                            <p><span className="block text-slate-500">Tipo trib.</span>{row.tipo || "—"}</p>
                            <p><span className="block text-slate-500">Cenário</span>{labelOf(CENARIOS, row.name)}</p>
                            <p><span className="block text-slate-500">Pessoa</span>{row.person === "juridica" ? "jurídica" : row.person || "—"}</p>
                            <p><span className="block text-slate-500">CFOP</span>{row.cfop || "—"}</p>
                            <p><span className="block text-slate-500">Situação Trib.</span>{row.cst || "—"}</p>
                          </div>
                        ))}
                        {!current.length ? <p className="text-xs text-slate-500">Nenhum cenário nesta aba.</p> : null}
                      </div>
                    </>
                  ) : <p className="text-sm text-slate-600">{item.ref} · serviço {item.service?.codigo_servico || ""}</p>}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "choice"} onOpenChange={(open) => !open && setStep(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-center">Criar Classe de Impostos para NFe/NFCe</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <button className="rounded border border-green-200 bg-green-50 p-4 text-left" onClick={() => setStep("simples")}>
              <p className="font-medium text-green-800">Simples Nacional/MEI</p>
              <p className="text-sm text-green-700">Criação automática com informações padrão para PIS, Cofins, IPI e IBS/CBS. ICMS editável.</p>
            </button>
            <button className="rounded border border-green-200 bg-green-50 p-4 text-left" onClick={() => setStep("manual")}>
              <p className="font-medium text-green-800">Configuração Manual</p>
              <p className="text-sm text-green-700">Criação manual de todos os impostos. Ideal para quando há especificações no PIS, IPI, Cofins ou IBS/CBS.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "simples"} onOpenChange={(open) => !open && setStep(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-center">Criar Classe de Impostos para NFe/NFCe</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-auto text-sm">
            <p>Adicione um nome para a sua classe de imposto que permita que você a identifique depois.</p>
            <div><p>Nome da classe:</p><Input value={nome} placeholder="Digite" onChange={(event) => setNome(event.target.value)} /></div>
            <p className="font-medium">ICMS</p>
            {cards.map((card, index) => (
              <div key={`${card.cenario}-${card.tipo_pessoa}-${index}`} className="space-y-2 rounded border bg-slate-50 p-3">
                <div><p>Cenário *</p><Select value={card.cenario} onValueChange={(value) => setCards(cards.map((item, i) => i === index ? { ...item, cenario: value, codigo_cfop: value.includes("fora") ? "6102" : "5102" } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CENARIOS.filter((item) => item.value !== "padrao").map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <div><p>Pessoa *</p><Select value={card.tipo_pessoa} onValueChange={(value) => setCards(cards.map((item, i) => i === index ? { ...item, tipo_pessoa: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="juridica">Jurídica</SelectItem><SelectItem value="fisica">Física</SelectItem></SelectContent></Select></div>
                <div><p>Situação tributária *</p><Select value={card.situacao_tributaria} onValueChange={(value) => setCards(cards.map((item, i) => i === index ? { ...item, situacao_tributaria: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CSOSN.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                {(card.situacao_tributaria === "101" || card.situacao_tributaria === "201") ? <div><p>Alíquota de crédito *</p><Input value={card.aliquota_credito} onChange={(event) => setCards(cards.map((item, i) => i === index ? { ...item, aliquota_credito: event.target.value } : item))} /></div> : null}
                <div><p>CFOP *</p><Input value={card.codigo_cfop} onChange={(event) => setCards(cards.map((item, i) => i === index ? { ...item, codigo_cfop: event.target.value.replace(/\D/g, "").slice(0, 4) } : item))} /></div>
                <Extras card={card} onChange={(next) => setCards(cards.map((item, i) => i === index ? next : item))} />
              </div>
            ))}
            <div className="flex justify-center"><Button disabled={saving} onClick={() => void save({ kind: "product", mode: "simples", referencia, descricao: nome, icms: cards.map((card) => ({ ...card, ...payloadExtras(card) })) })}>{saving ? "Salvando..." : "Finalizar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "manual"} onOpenChange={(open) => !open && setStep(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-center">Criar Classe de Impostos para NFe/NFCe</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-auto text-sm">
            <p>Crie pelo menos 1 cenário para cada imposto. Você pode criar até 4 cenários para cada imposto dentro de uma mesma classe.</p>
            <div><p>Descrição da classe:</p><Input value={nome} placeholder="Digite" onChange={(event) => setNome(event.target.value)} /></div>
            <div className="space-y-2 rounded bg-slate-100 p-3">
              <div><p>Selecione o imposto:</p><Select value={draft.tax} onValueChange={(value) => setDraft({ ...draft, tax: value, cenario: value === "icms" && draft.cenario === "padrao" ? "saida_dentro_estado" : draft.cenario, situacao_tributaria: value === "icms" ? "102" : value === "ibs_cbs" ? "000" : "99" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="icms">ICMS</SelectItem><SelectItem value="ipi">IPI</SelectItem><SelectItem value="pis">PIS</SelectItem><SelectItem value="cofins">COFINS</SelectItem><SelectItem value="ibs_cbs">IBS/CBS</SelectItem></SelectContent></Select></div>
              <div><p>Criar cenário para:</p><Select value={draft.cenario} onValueChange={(value) => setDraft({ ...draft, cenario: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CENARIOS.filter((item) => draft.tax !== "icms" || item.value !== "padrao").map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2 md:grid-cols-3">
                <div><p>Pessoa:</p><Select value={draft.tipo_pessoa} onValueChange={(value) => setDraft({ ...draft, tipo_pessoa: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fisica">Física</SelectItem><SelectItem value="juridica">Jurídica</SelectItem></SelectContent></Select></div>
                <div><p>Situação tributária:</p>{draft.tax === "ibs_cbs" ? <Input value={draft.situacao_tributaria} onChange={(event) => setDraft({ ...draft, situacao_tributaria: event.target.value.replace(/\D/g, "").slice(0, 3) })} /> : <Select value={draft.situacao_tributaria || "102"} onValueChange={(value) => setDraft({ ...draft, situacao_tributaria: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(draft.tax === "icms" ? cstOptions : draft.tax === "ipi" ? IPI : PIS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}</div>
                {draft.tax !== "icms" && draft.tax !== "ibs_cbs" ? <div><p>Alíquota:</p><Input value={draft.aliquota} onChange={(event) => setDraft({ ...draft, aliquota: event.target.value })} /></div> : null}
              </div>
              {draft.tax === "icms" ? <div><p>Tipo de tributação</p><Select value={draft.tipo_tributacao} onValueChange={(value) => setDraft({ ...draft, tipo_tributacao: value, situacao_tributaria: value === "tributacao_normal" ? "00" : "102" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="simples_nacional">Simples Nacional</SelectItem><SelectItem value="simples_nacional_sublimite">Simples Nacional sublimite</SelectItem><SelectItem value="tributacao_normal">Tributação normal</SelectItem></SelectContent></Select></div> : null}
              {draft.tax === "icms" ? <div><p>CFOP</p><Input value={draft.codigo_cfop} onChange={(event) => setDraft({ ...draft, codigo_cfop: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></div> : null}
              {(draft.tax === "icms" && (draft.situacao_tributaria === "101" || draft.situacao_tributaria === "201")) ? <div><p>Alíquota de crédito</p><Input value={draft.aliquota_credito} onChange={(event) => setDraft({ ...draft, aliquota_credito: event.target.value })} /></div> : null}
              {draft.tax === "ibs_cbs" ? <div><p>Classificação tributária</p><Input value={draft.classificacao_tributaria} placeholder="000001" onChange={(event) => setDraft({ ...draft, classificacao_tributaria: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></div> : null}
              {draft.tax === "icms" ? <Extras card={draft} onChange={(next) => setDraft({ ...draft, ...next })} /> : null}
              <div className="flex justify-end"><Button type="button" onClick={addManual}>Criar cenário</Button></div>
            </div>
            {rows.map((row, index) => <p key={`${row.tax}-${index}`} className="text-xs">{row.tax.toUpperCase()} · {labelOf(CENARIOS, row.cenario)} · {row.tipo_pessoa} · {row.situacao_tributaria} <button className="text-red-600" onClick={() => setRows(rows.filter((_, i) => i !== index))}>remover</button></p>)}
            <div className="flex justify-center"><Button disabled={saving} onClick={() => void save({
              kind: "product", mode: "manual", referencia, descricao: nome,
              icms: rows.filter((row) => row.tax === "icms").map((row) => ({ ...row, ...payloadExtras(row) })),
              ipi: rows.filter((row) => row.tax === "ipi"),
              pis: rows.filter((row) => row.tax === "pis"),
              cofins: rows.filter((row) => row.tax === "cofins"),
              ibs_cbs: rows.filter((row) => row.tax === "ibs_cbs"),
            })}>{saving ? "Salvando..." : "Finalizar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "service"} onOpenChange={(open) => !open && setStep(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-center">Criar classe de imposto para NFS-e</DialogTitle></DialogHeader>
          <div className="grid max-h-[70vh] gap-2 overflow-auto text-sm md:grid-cols-2">
            <div className="md:col-span-2"><p>Descrição</p><Input value={nome} onChange={(event) => setNome(event.target.value)} /></div>
            <div><p>Código do serviço</p><Input value={service.codigo_servico} onChange={(event) => setService({ ...service, codigo_servico: event.target.value })} /></div>
            <div><p>Natureza da operação</p><Select value={service.natureza_operacao} onValueChange={(value) => setService({ ...service, natureza_operacao: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 - Tributação no município</SelectItem><SelectItem value="2">2 - Tributação fora do município</SelectItem><SelectItem value="3">3 - Isenção</SelectItem><SelectItem value="4">4 - Imune</SelectItem><SelectItem value="5">5 - Exigibilidade suspensa judicial</SelectItem><SelectItem value="6">6 - Exigibilidade suspensa administrativa</SelectItem></SelectContent></Select></div>
            <div><p>Exigibilidade do ISS</p><Select value={service.exigibilidade_iss} onValueChange={(value) => setService({ ...service, exigibilidade_iss: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "3", "4", "5", "6", "7"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div><p>ISS retido</p><Select value={service.iss_retido} onValueChange={(value) => setService({ ...service, iss_retido: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">2 - Não</SelectItem><SelectItem value="1">1 - Sim</SelectItem></SelectContent></Select></div>
            {service.iss_retido === "1" ? <div><p>Responsável da retenção</p><Select value={service.responsavel_retencao} onValueChange={(value) => setService({ ...service, responsavel_retencao: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 - Tomador</SelectItem><SelectItem value="2">2 - Intermediário</SelectItem></SelectContent></Select></div> : null}
            {(["iss", "pis", "cofins", "inss", "ir", "csll"] as const).map((key) => <div key={key}><p>Alíquota {key.toUpperCase()}</p><Input value={service[key]} onChange={(event) => setService({ ...service, [key]: event.target.value })} /></div>)}
            <div><p>Situação IBS/CBS</p><Input value={service.situacao_tributaria} onChange={(event) => setService({ ...service, situacao_tributaria: event.target.value })} /></div>
            <div><p>Classificação IBS/CBS</p><Input value={service.classificacao_tributaria} onChange={(event) => setService({ ...service, classificacao_tributaria: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></div>
            <div className="md:col-span-2 flex justify-center"><Button disabled={saving} onClick={() => void save({ kind: "service", referencia, descricao: nome, ...service })}>{saving ? "Salvando..." : "Finalizar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeRef)} onOpenChange={(open) => !open && setRemoveRef("")}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir classe</DialogTitle></DialogHeader>
          <p className="text-sm">A classe {removeRef} deixa de valer para as próximas notas desta empresa.</p>
          <Button variant="destructive" disabled={saving} onClick={() => {
            if (!orgId) return;
            setSaving(true);
            void fiscalCall(orgId, "class-delete", { method: "POST", body: JSON.stringify({ referencia: removeRef }) })
              .then(async () => { setRemoveRef(""); toast({ title: "Classe excluída" }); await onSaved(); })
              .catch((error) => toast({ title: error instanceof Error ? error.message : "Não foi possível excluir", variant: "destructive" }))
              .finally(() => setSaving(false));
          }}>Excluir</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
