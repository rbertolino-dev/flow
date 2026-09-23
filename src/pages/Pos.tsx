import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useServices } from "@/hooks/useServices";
import { usePosSales } from "@/hooks/usePosSales";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import {
  DEFAULT_POS_SETTINGS,
  type FinalizeSaleResult,
  type PosCartItem,
  type PosPaymentLine,
  type PosSettings,
} from "@/types/pos";
import { PosConfirmSaleDialog, type PosConfirmSaleValues } from "@/components/pos/PosConfirmSaleDialog";
import { PosSaleSuccessDialog } from "@/components/pos/PosSaleSuccessDialog";
import { PosCreateClientDialog } from "@/components/pos/PosCreateClientDialog";
import { PosCreateServiceDialog } from "@/components/pos/PosCreateServiceDialog";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { useToast } from "@/hooks/use-toast";
import {
  History,
  Plus,
  Search,
  Package,
  Trash2,
  ScanBarcode,
  Loader2,
  UserPlus,
  X,
  Wrench,
  Pencil,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CASH_SHORTCUTS = [
  { key: "F2", label: "Cliente" },
  { key: "F3", label: "Buscar" },
  { key: "F4", label: "Barras" },
  { key: "F6", label: "Desconto" },
  { key: "F7", label: "Pagamento" },
  { key: "F8", label: "Limpar" },
  { key: "F9", label: "Histórico" },
  { key: "F10", label: "Novo cliente" },
  { key: "F12", label: "Finalizar" },
] as const;

function stockLabel(qty: number | null | undefined) {
  const n = Number(qty ?? 0);
  if (n < 0) return `Estoque negativo em ${n} Un`;
  if (n === 0) return "Estoque zerado";
  return `Qntd em estoque: ${n} Un`;
}

function stockClass(qty: number | null | undefined) {
  const n = Number(qty ?? 0);
  if (n < 0) return "text-amber-600";
  if (n === 0) return "text-destructive";
  return "text-muted-foreground";
}

interface LeadOption {
  id: string;
  name: string;
  phone: string;
  company?: string | null;
}

interface OrgMemberOption {
  id: string;
  full_name: string | null;
  email: string;
}

export default function Pos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId, activeOrganization } = useActiveOrganization();
  const { products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { services = [], loading: servicesLoading, refetch: refetchServices } =
    useServices();
  const { loading: posLoading, finalizeSale, getOpenCashSession, openCash, getPosSettings } =
    usePosSales();

  const [catalogTab, setCatalogTab] = useState<"products" | "services">("products");
  const [search, setSearch] = useState("");
  const [exactSearch, setExactSearch] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [barcodeDraft, setBarcodeDraft] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const paymentTriggerRef = useRef<HTMLButtonElement>(null);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [addCommission, setAddCommission] = useState(false);
  const [commissionUserId, setCommissionUserId] = useState("");
  const [payments, setPayments] = useState<PosPaymentLine[]>([]);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<string>("");

  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);

  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSale, setLastSale] = useState<FinalizeSaleResult | null>(null);
  const [lastSaleItems, setLastSaleItems] = useState<PosCartItem[]>([]);
  const [lastSalePayments, setLastSalePayments] = useState<PosPaymentLine[]>([]);
  const [nextSaleNumberHint, setNextSaleNumberHint] = useState<string>("—");
  const [posSettings, setPosSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [defaultLead, setDefaultLead] = useState<LeadOption | null>(null);
  const [orgPrintInfo, setOrgPrintInfo] = useState<{
    name?: string | null;
    cnpj?: string | null;
    address?: string | null;
  }>({});

  useEffect(() => {
    if (!activeOrgId) return;
    void (async () => {
      const session = await getOpenCashSession();
      if (!session) {
        try {
          await openCash(0);
        } catch {
          // ignore
        }
      }
    })();
  }, [activeOrgId, getOpenCashSession, openCash]);

  useEffect(() => {
    if (!activeOrgId) {
      setOrgPrintInfo({});
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name, cnpj, address")
        .eq("id", activeOrgId)
        .maybeSingle();
      setOrgPrintInfo({
        name: data?.name || activeOrganization?.name || null,
        cnpj: (data as { cnpj?: string | null } | null)?.cnpj || null,
        address: (data as { address?: string | null } | null)?.address || null,
      });
    })();
  }, [activeOrgId, activeOrganization?.name]);

  useEffect(() => {
    if (!activeOrgId) {
      setOrgMembers([]);
      return;
    }
    void (async () => {
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", activeOrgId);
      const ids = (members || []).map((m) => m.user_id);
      if (!ids.length) {
        setOrgMembers([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
        .order("full_name", { ascending: true });
      setOrgMembers((profiles || []) as OrgMemberOption[]);
    })();
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    getPosSettings()
      .then((settings) => {
        if (!cancelled) setPosSettings(settings);
      })
      .catch(() => {
        if (!cancelled) setPosSettings(DEFAULT_POS_SETTINGS);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, getPosSettings]);

  useEffect(() => {
    if (posSettings.sale_notes) {
      setNotes((current) => current || posSettings.sale_notes);
    }
    if (posSettings.commission_required) setAddCommission(true);
  }, [posSettings]);

  useEffect(() => {
    if (!activeOrgId || !posSettings.default_lead_id) {
      setDefaultLead(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("leads")
      .select("id, name, phone, company")
      .eq("id", posSettings.default_lead_id)
      .eq("organization_id", activeOrgId)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const lead = (data || null) as LeadOption | null;
        setDefaultLead(lead);
        if (lead) setSelectedLead((current) => current ?? lead);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, posSettings.default_lead_id]);

  useEffect(() => {
    if (!activeOrgId || leadQuery.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingLeads(true);
      try {
        const q = leadQuery.trim();
        const { data } = await supabase
          .from("leads")
          .select("id, name, phone, company")
          .eq("organization_id", activeOrgId)
          .is("deleted_at", null)
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`)
          .limit(10);
        setLeadOptions((data || []) as LeadOption[]);
      } catch {
        setLeadOptions([]);
      } finally {
        setSearchingLeads(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery, activeOrgId]);

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => {
      if (!p.is_active) return false;
      if (!posSettings.block_out_of_stock) return true;
      return Number(p.stock_quantity ?? 0) > 0;
    });
    if (barcodeMode) {
      const order = new Map(scannedIds.map((id, i) => [id, i]));
      return active
        .filter((p) => order.has(p.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((p) => {
      const hay = `${p.name} ${p.sku || ""} ${p.barcode || ""} ${p.category || ""}`.toLowerCase();
      if (exactSearch) {
        return (
          p.name.toLowerCase() === q ||
          (p.sku || "").toLowerCase() === q ||
          (p.barcode || "").toLowerCase() === q
        );
      }
      return hay.includes(q);
    });
  }, [products, search, exactSearch, barcodeMode, scannedIds, posSettings.block_out_of_stock]);

  const filteredServices = useMemo(() => {
    const active = services.filter((s) => s.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((s) => {
      const hay = `${s.name} ${s.category || ""}`.toLowerCase();
      return exactSearch ? s.name.toLowerCase() === q : hay.includes(q);
    });
  }, [services, search, exactSearch]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.quantity * i.unit_price - i.discount_amount, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - discount);
  const paymentsSum = payments.reduce((s, p) => s + p.amount, 0);

  const commissionUserName = useMemo(() => {
    const u = orgMembers.find((m) => m.id === commissionUserId);
    return u?.full_name || u?.email || null;
  }, [orgMembers, commissionUserId]);

  const addProductToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "product" && i.item_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `product-${product.id}`,
          item_type: "product",
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || "un",
          quantity: 1,
          unit_price: Number(product.price),
          discount_amount: 0,
          stock_quantity: product.stock_quantity,
        },
      ];
    });
  };

  const pushProductToCart = (product: {
    id: string;
    name: string;
    sku?: string | null;
    unit?: string | null;
    price: number;
    stock_quantity?: number | null;
  }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "product" && i.item_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `product-${product.id}`,
          item_type: "product" as const,
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || "un",
          quantity: 1,
          unit_price: Number(product.price),
          discount_amount: 0,
          stock_quantity: product.stock_quantity,
        },
      ];
    });
  };

  const addServiceToCart = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "service" && i.item_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `service-${service.id}`,
          item_type: "service",
          item_id: service.id,
          name: service.name,
          unit: "un",
          quantity: 1,
          unit_price: Number(service.price),
          discount_amount: 0,
        },
      ];
    });
  };

  const pushServiceToCart = (service: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_type === "service" && i.item_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: `service-${service.id}`,
          item_type: "service" as const,
          item_id: service.id,
          name: service.name,
          unit: "un",
          quantity: 1,
          unit_price: Number(service.price),
          discount_amount: 0,
        },
      ];
    });
  };

  const updateCartQty = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.key !== key));
      return;
    }
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)));
  };

  const removeCartItem = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const updateCartItem = (
    key: string,
    patch: Partial<Pick<PosCartItem, "quantity" | "unit_price" | "discount_amount">>
  ) => {
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  useEffect(() => {
    if (barcodeMode) barcodeInputRef.current?.focus();
  }, [barcodeMode]);

  const handleBarcodeScan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const norm = code.replace(/\s/g, "").toLowerCase();
    const primaryField = posSettings.stock_code_field === "barcode" ? "barcode" : "sku";
    const secondaryField = primaryField === "barcode" ? "sku" : "barcode";
    const matchesField = (field: "barcode" | "sku") =>
      products.find((p) => (p[field] || "").replace(/\s/g, "").toLowerCase() === norm);
    const product = matchesField(primaryField) || matchesField(secondaryField);
    if (!product) {
      toast({
        title: "Código não encontrado",
        description: `Nenhum produto com código ${code}`,
        variant: "destructive",
      });
      setBarcodeDraft("");
      return;
    }
    setScannedIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]));
    pushProductToCart({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      price: Number(product.price),
      stock_quantity: product.stock_quantity,
    });
    setBarcodeDraft("");
  };

  const addPayment = () => {
    if (!paymentMethodDraft || total <= 0) return;
    const remaining = Math.max(0, total - paymentsSum);
    if (remaining <= 0) return;
    setPayments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: paymentMethodDraft,
        amount: Number(remaining.toFixed(2)),
      },
    ]);
    setPaymentMethodDraft("");
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setNotes(posSettings.sale_notes || "");
    setAddCommission(posSettings.commission_required);
    setCommissionUserId("");
    setPayments([]);
    setPaymentMethodDraft("");
    setSelectedLead(defaultLead);
    setLeadQuery("");
    setSearch("");
    setBarcodeDraft("");
    setScannedIds([]);
  };

  const openConfirmDialog = () => {
    if (!cart.length) return;
    if (!selectedLead) {
      toast({
        title: "Selecione um cliente",
        description: "Escolha um cliente cadastrado na organização ou crie um novo.",
        variant: "destructive",
      });
      return;
    }
    if ((addCommission || posSettings.commission_required) && !commissionUserId) {
      toast({
        title: "Selecione o usuário da comissão",
        description: "Com a comissão ativa, escolha o colaborador vinculado.",
        variant: "destructive",
      });
      return;
    }
    if (posSettings.simple_sale) {
      const method = payments[0]?.method || paymentMethodDraft || "pix";
      const dateLabel = new Date().toLocaleDateString("pt-BR");
      const today = new Date();
      const paymentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      void handleConfirmSale(
        {
          applyStock: true,
          generateFinancial: true,
          saleDescription:
            notes ||
            (selectedLead ? `Venda - ${selectedLead.name} - ${dateLabel}` : `Venda - ${dateLabel}`),
          paymentDate,
          financialAccount:
            posSettings.financial_account || activeOrganization?.name || "Conta principal",
          financialCategory: posSettings.financial_category,
          paymentMethod: method,
          paymentNotes: notes,
          splitRecurrence: false,
        },
        {
          id: crypto.randomUUID(),
          method,
          amount: Number(total.toFixed(2)),
        }
      );
      return;
    }
    setNextSaleNumberHint("novo");
    setConfirmOpen(true);
  };

  const anyDialogOpen =
    confirmOpen ||
    successOpen ||
    createClientOpen ||
    createProductOpen ||
    createServiceOpen;

  const runCashShortcut = (key: string) => {
    if (anyDialogOpen) return false;
    switch (key) {
      case "F2":
        clientInputRef.current?.focus();
        clientInputRef.current?.select();
        return true;
      case "F3":
        setBarcodeMode(false);
        setCatalogTab("products");
        window.setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 0);
        return true;
      case "F4":
        setCatalogTab("products");
        setBarcodeMode(true);
        window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
        return true;
      case "F10":
        if (activeOrgId) setCreateClientOpen(true);
        return true;
      case "F6":
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return true;
      case "F7":
        paymentTriggerRef.current?.focus();
        paymentTriggerRef.current?.click();
        return true;
      case "F8":
        if (cart.length) {
          setCart([]);
          toast({ title: "Venda limpa", description: "Itens removidos do resumo." });
        }
        return true;
      case "F9":
        navigate("/pdv/historico");
        return true;
      case "F12":
        openConfirmDialog();
        return true;
      default:
        return false;
    }
  };

  const runCashShortcutRef = useRef(runCashShortcut);
  runCashShortcutRef.current = runCashShortcut;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !/^F\d{1,2}$/.test(event.key)) return;
      if (runCashShortcutRef.current(event.key)) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleConfirmSale = async (
    values: PosConfirmSaleValues,
    confirmPayment: PosPaymentLine
  ) => {
    // Prefer payments already added in sidebar; otherwise use confirm dialog method
    let finalPayments = [...payments];
    if (!finalPayments.length) {
      if (paymentMethodDraft) {
        finalPayments = [
          {
            id: crypto.randomUUID(),
            method: paymentMethodDraft,
            amount: Number(total.toFixed(2)),
          },
        ];
      } else {
        finalPayments = [confirmPayment];
      }
    } else if (Math.abs(paymentsSum - total) > 0.05) {
      finalPayments = [
        ...finalPayments,
        {
          id: crypto.randomUUID(),
          method: confirmPayment.method,
          amount: Number((total - paymentsSum).toFixed(2)),
        },
      ];
    }

    // Force the primary payment method from confirm dialog when single payment
    if (finalPayments.length === 1) {
      finalPayments = [
        {
          ...finalPayments[0],
          method: values.paymentMethod || finalPayments[0].method,
          amount: Number(total.toFixed(2)),
        },
      ];
    }

    const snapshotItems = [...cart];
    const snapshotPayments = [...finalPayments];

    try {
      const result = await finalizeSale({
        items: snapshotItems.map((i) => ({
          item_type: i.item_type,
          item_id: i.item_id,
          name: i.name,
          sku: i.sku,
          unit: i.unit,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
        })),
        payments: finalPayments.map((p) => ({ method: p.method, amount: p.amount })),
        discount_amount: discount,
        notes: notes || values.paymentNotes || null,
        add_commission: addCommission,
        commission_user_id: addCommission ? commissionUserId : null,
        commission_user_name: addCommission ? commissionUserName : null,
        lead_id: selectedLead?.id || null,
        customer_name: selectedLead?.name || null,
        customer_phone: selectedLead?.phone || null,
        apply_stock: values.applyStock,
        generate_financial: values.generateFinancial,
        payment_date: values.paymentDate,
        payment_notes: values.paymentNotes || null,
        sale_description: values.saleDescription || null,
        financial_account: values.financialAccount || null,
        financial_category: values.financialCategory || null,
        default_commission_type: posSettings.commission_type,
        default_commission_value: posSettings.commission_value,
      });

      setConfirmOpen(false);
      setLastSale({
        ...result,
        customer_name: selectedLead?.name || result.customer_name || null,
        customer_phone: selectedLead?.phone || result.customer_phone || null,
        sold_by_name: result.sold_by_name || null,
        notes: notes || values.paymentNotes || null,
        sale_description: values.saleDescription || null,
        sold_at: result.sold_at || new Date().toISOString(),
        subtotal: result.subtotal ?? total,
      });
      setLastSaleItems(snapshotItems);
      setLastSalePayments(snapshotPayments);
      resetSale();
      await refetchProducts();
      setSuccessOpen(true);
    } catch {
      // toast no hook
    }
  };

  const canOpenConfirm =
    cart.length > 0 &&
    total >= 0 &&
    !!selectedLead &&
    (!(addCommission || posSettings.commission_required) || !!commissionUserId) &&
    !posLoading;

  return (
    <CRMLayout activeView="pdv" onViewChange={() => {}}>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Configurações do PDV"
              aria-label="Configurações do PDV"
              onClick={() => navigate("/pdv/configuracoes")}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/pdv/historico")}>
              <History className="mr-2 h-4 w-4" />
              Histórico de vendas
            </Button>
          </div>

          <div className="relative flex min-w-[260px] max-w-lg flex-1 items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Cliente</span>
            <div className="relative flex-1">
              <Input
                ref={clientInputRef}
                placeholder="Buscar cliente da organização..."
                value={selectedLead ? selectedLead.name : leadQuery}
                onChange={(e) => {
                  setSelectedLead(null);
                  setLeadQuery(e.target.value);
                }}
                className="pr-8"
              />
              {selectedLead && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedLead(null);
                    setLeadQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {!selectedLead && leadOptions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {leadOptions.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setSelectedLead(lead);
                        setLeadQuery("");
                        setLeadOptions([]);
                      }}
                    >
                      <span className="font-medium">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {lead.phone}
                        {lead.company ? ` · ${lead.company}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchingLeads && (
                <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              title="Criar cliente nesta organização"
              onClick={() => setCreateClientOpen(true)}
              disabled={!activeOrgId}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b bg-slate-100 px-3 py-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Caixa
          </span>
          {CASH_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => runCashShortcut(shortcut.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium shadow-sm",
                shortcut.key === "F12"
                  ? "border-blue-800 bg-blue-700 text-white hover:bg-blue-800"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              )}
            >
              <kbd
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  shortcut.key === "F12"
                    ? "bg-blue-900 text-white"
                    : "bg-slate-800 text-white"
                )}
              >
                {shortcut.key}
              </kbd>
              {shortcut.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_494px]">
          <div className="flex min-h-0 flex-col border-r">
            <Tabs
              value={catalogTab}
              onValueChange={(v) => setCatalogTab(v as "products" | "services")}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="products">Produtos</TabsTrigger>
                  <TabsTrigger value="services">Serviços</TabsTrigger>
                </TabsList>
                <div className="mt-3 flex flex-wrap items-center gap-2 pb-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      className="pl-8"
                      placeholder="Busque por nome, código ou descrição"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant={exactSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExactSearch((v) => !v)}
                  >
                    Busca Exata
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title={
                      catalogTab === "products"
                        ? "Cadastrar novo produto"
                        : "Cadastrar novo serviço"
                    }
                    aria-label={
                      catalogTab === "products"
                        ? "Cadastrar novo produto"
                        : "Cadastrar novo serviço"
                    }
                    onClick={() => {
                      if (catalogTab === "products") {
                        setCreateProductOpen(true);
                      } else {
                        setCreateServiceOpen(true);
                      }
                    }}
                  >
                    {catalogTab === "products" ? (
                      <Package className="h-5 w-5" />
                    ) : (
                      <Wrench className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>

              <TabsContent value="products" className="mt-0 min-h-0 flex-1 overflow-y-auto p-0">
                {productsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    {barcodeMode
                      ? "Modo código de barras ativo. Bipe um produto para ele aparecer aqui."
                      : "Nenhum produto encontrado."}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {filteredProducts.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50"
                          onClick={() => addProductToCart(p.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium leading-snug">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Código:{" "}
                              {(posSettings.stock_code_field === "barcode"
                                ? p.barcode || p.sku
                                : p.sku || p.barcode) || "—"}
                            </p>
                            <p className={cn("text-xs", stockClass(p.stock_quantity))}>
                              {stockLabel(p.stock_quantity)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-primary">
                            {formatMoney(Number(p.price))} {p.unit || "Un"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="services" className="mt-0 min-h-0 flex-1 overflow-y-auto p-0">
                {servicesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredServices.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
                ) : (
                  <ul className="divide-y">
                    {filteredServices.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50"
                          onClick={() => addServiceToCart(s.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            {s.category && (
                              <p className="text-xs text-muted-foreground">{s.category}</p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-primary">
                            {formatMoney(Number(s.price))} Un
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex min-h-0 flex-col border-l-4 border-l-blue-700 bg-background shadow-xl">
            <div className="flex items-center justify-between border-b bg-blue-50 px-4 py-4">
              <h2 className="text-3xl font-bold tracking-tight text-blue-950">Resumo</h2>
              <Button
                type="button"
                variant={barcodeMode ? "default" : "outline"}
                size="icon"
                title={
                  barcodeMode
                    ? "Sair do modo código de barras"
                    : "Ler código de barras — a lista some e só aparecem os produtos bipados"
                }
                aria-label="Leitor de código de barras"
                onClick={() => {
                  setBarcodeMode((v) => !v);
                  setCatalogTab("products");
                }}
              >
                <ScanBarcode className="h-5 w-5" />
              </Button>
            </div>

            {barcodeMode && (
              <div className="border-b px-4 py-2">
                <Input
                  ref={barcodeInputRef}
                  placeholder="Bipe o código de barras"
                  value={barcodeDraft}
                  onChange={(e) => setBarcodeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeScan(barcodeDraft);
                    }
                  }}
                />
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-base text-muted-foreground">
                  Clique em um produto ou serviço para adicionar ao resumo.
                </p>
              ) : (
                <ul className="space-y-4">
                  {cart.map((item) => {
                    const lineTotal = item.quantity * item.unit_price - item.discount_amount;
                    return (
                      <li key={item.key} className="border-b pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xl font-bold leading-snug text-slate-900">
                            {item.name}
                            <span className="text-lg font-semibold text-muted-foreground">
                              {" "}
                              - {item.unit || "Un"}
                            </span>
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-xl font-bold tabular-nums text-slate-900">
                              {formatMoney(lineTotal)}
                            </span>
                            <Pencil className="h-4 w-4 text-sky-600" />
                            <button type="button" onClick={() => removeCartItem(item.key)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Valor unit:</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-10 text-base"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateCartItem(item.key, {
                                  unit_price: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Qnt:</Label>
                            <Input
                              type="number"
                              min={0.001}
                              step="1"
                              className="h-10 text-base"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQty(item.key, Number(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Desconto:</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-10 text-base"
                              placeholder="Digite"
                              value={item.discount_amount || ""}
                              onChange={(e) =>
                                updateCartItem(item.key, {
                                  discount_amount: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {cart.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={() => setCart([])}
                  >
                    Limpar Tudo
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Desconto geral</Label>
                <Input
                  ref={discountInputRef}
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-10 text-base"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0,00"
                />
              </div>

              {posSettings.show_payment_method && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Formas de pagamento</Label>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span>
                      {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{formatMoney(p.amount)}</span>
                      <button type="button" onClick={() => removePayment(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select value={paymentMethodDraft} onValueChange={setPaymentMethodDraft}>
                    <SelectTrigger ref={paymentTriggerRef} className="flex-1">
                      <SelectValue placeholder="Adicione uma ou mais formas de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addPayment}
                    disabled={!paymentMethodDraft || total - paymentsSum <= 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              )}

              <Textarea
                placeholder="Observações"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              <div className="space-y-2 rounded-md border bg-background p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-commission">Adicionar comissão</Label>
                  <Switch
                    id="add-commission"
                    checked={addCommission || posSettings.commission_required}
                    disabled={posSettings.commission_required}
                    onCheckedChange={(v) => {
                      if (posSettings.commission_required) return;
                      setAddCommission(v);
                      if (!v) setCommissionUserId("");
                    }}
                  />
                </div>
                {posSettings.commission_required && (
                  <p className="text-xs text-muted-foreground">
                    Comissão obrigatória pela configuração do PDV.
                  </p>
                )}
                {addCommission && (
                  <div className="space-y-1">
                    <Label className="text-xs">Usuário vinculado à comissão</Label>
                    <Select value={commissionUserId} onValueChange={setCommissionUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between bg-blue-700 px-4 py-4 text-white">
                <span className="text-xl font-bold">Subtotal:</span>
                <span className="text-4xl font-bold tabular-nums">
                  {total.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="border-t p-4">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canOpenConfirm}
                  onClick={openConfirmDialog}
                >
                  Finalizar
                  <kbd className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs font-bold">F12</kbd>
                </Button>
                {!selectedLead && cart.length > 0 && (
                  <p className="mt-2 text-center text-xs text-destructive">
                    Selecione ou crie um cliente da organização para continuar
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeOrgId && (
        <PosCreateClientDialog
          open={createClientOpen}
          onOpenChange={setCreateClientOpen}
          organizationId={activeOrgId}
          onCreated={(client) => {
            setSelectedLead(client);
            setLeadQuery("");
          }}
        />
      )}

      <CreateProductDialog
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        onProductCreated={(product) => {
          void refetchProducts();
          pushProductToCart({
            id: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            price: Number(product.price),
            stock_quantity: product.stock_quantity,
          });
          toast({
            title: "Produto cadastrado",
            description: `${product.name} adicionado à venda`,
          });
        }}
      />

      <PosCreateServiceDialog
        open={createServiceOpen}
        onOpenChange={setCreateServiceOpen}
        onCreated={(service) => {
          void refetchServices();
          pushServiceToCart(service);
          toast({
            title: "Serviço cadastrado",
            description: `${service.name} adicionado à venda`,
          });
        }}
      />

      <PosConfirmSaleDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        saleCodePreview={nextSaleNumberHint}
        total={total}
        customerName={
          selectedLead
            ? `${selectedLead.name}${selectedLead.company ? ` - ${selectedLead.company}` : ""}`
            : null
        }
        organizationName={activeOrganization?.name}
        defaultPaymentMethod={payments[0]?.method || paymentMethodDraft || "pix"}
        defaultFinancialAccount={posSettings.financial_account}
        defaultFinancialCategory={posSettings.financial_category}
        defaultNotes={posSettings.sale_notes}
        loading={posLoading}
        onConfirm={(values, payment) => void handleConfirmSale(values, payment)}
      />

      <PosSaleSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        sale={lastSale}
        items={lastSaleItems}
        payments={lastSalePayments}
        organizationName={orgPrintInfo.name || activeOrganization?.name}
        organization={orgPrintInfo}
        onNewSale={() => {
          setSuccessOpen(false);
          setLastSale(null);
          resetSale();
        }}
      />
    </CRMLayout>
  );
}
