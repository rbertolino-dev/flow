import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useWholesalePriceEnabled } from "@/hooks/useWholesalePriceEnabled";
import { resolveProductUnitPrice, productHasWholesalePrice, type ProductPriceTier } from "@/lib/productPricing";
import { isListedForSale, isSalePaused } from "@/lib/productAvailability";
import { useServices } from "@/hooks/useServices";
import { usePosSales } from "@/hooks/usePosSales";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import { isPromotionValid, quotePosSale } from "@/lib/posAdjustments";
import { paymentsMatchTotal, roundMoney } from "@/lib/posFinanceSchedule";
import {
  DEFAULT_POS_SETTINGS,
  type FinalizeSaleResult,
  type PosCartItem,
  type PosFinanceEntryRef,
  type PosPaymentLine,
  type PosSettings,
} from "@/types/pos";
import { PosConfirmSaleDialog, type PosConfirmSaleValues } from "@/components/pos/PosConfirmSaleDialog";
import { PosFinanceCreatedDialog } from "@/components/pos/PosFinanceCreatedDialog";
import { PosSaleSuccessDialog } from "@/components/pos/PosSaleSuccessDialog";
import { PosCreateClientDialog } from "@/components/pos/PosCreateClientDialog";
import { PosCreateServiceDialog } from "@/components/pos/PosCreateServiceDialog";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
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

const CATALOG_PAGE_SIZE = 20;

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
  const wholesaleEnabled = useWholesalePriceEnabled();
  const [priceTier, setPriceTier] = useState<ProductPriceTier>("retail");
  const { services = [], loading: servicesLoading, refetch: refetchServices } =
    useServices();
  const { loading: posLoading, finalizeSale, getOpenCashSession, openCash, getPosSettings } =
    usePosSales();

  const [catalogTab, setCatalogTab] = useState<"products" | "services">("products");
  const [catalogPage, setCatalogPage] = useState(1);
  const [search, setSearch] = useState("");
  const [exactSearch, setExactSearch] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState("");
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [mobilePane, setMobilePane] = useState<"catalog" | "summary">("catalog");
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [barcodeDraft, setBarcodeDraft] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const catalogScrollRef = useRef<HTMLDivElement>(null);
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
  const [installments, setInstallments] = useState(1);
  const [promotionId, setPromotionId] = useState("");

  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);

  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeEntries, setFinanceEntries] = useState<PosFinanceEntryRef[]>([]);
  const [financeDescription, setFinanceDescription] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSale, setLastSale] = useState<FinalizeSaleResult | null>(null);
  const [lastSaleLeadId, setLastSaleLeadId] = useState<string | null>(null);
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

  const productCategories = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      const name = (product.category || "").trim();
      if (isListedForSale(product) && name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => {
      if (!isListedForSale(p)) return false;
      if (wholesaleEnabled && priceTier === "wholesale" && !productHasWholesalePrice(p)) return false;
      if (catalogCategory && (p.category || "").trim() !== catalogCategory) return false;
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
  }, [
    products,
    search,
    exactSearch,
    barcodeMode,
    scannedIds,
    posSettings.block_out_of_stock,
    catalogCategory,
    wholesaleEnabled,
    priceTier,
  ]);

  const filteredServices = useMemo(() => {
    const active = services.filter((s) => s.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((s) => {
      const hay = `${s.name} ${s.category || ""}`.toLowerCase();
      return exactSearch ? s.name.toLowerCase() === q : hay.includes(q);
    });
  }, [services, search, exactSearch]);

  const catalogTotal = catalogTab === "services" ? filteredServices.length : filteredProducts.length;
  const catalogPageCount = Math.max(1, Math.ceil(catalogTotal / CATALOG_PAGE_SIZE));
  const catalogPageSafe = Math.min(catalogPage, catalogPageCount);
  const catalogFrom = catalogTotal === 0 ? 0 : (catalogPageSafe - 1) * CATALOG_PAGE_SIZE;
  const pagedProducts = filteredProducts.slice(catalogFrom, catalogFrom + CATALOG_PAGE_SIZE);
  const pagedServices = filteredServices.slice(catalogFrom, catalogFrom + CATALOG_PAGE_SIZE);

  useEffect(() => {
    setCatalogPage(1);
  }, [search, exactSearch, catalogCategory, catalogTab, priceTier, barcodeMode]);

  useEffect(() => {
    if (catalogPage > catalogPageCount) setCatalogPage(catalogPageCount);
  }, [catalogPage, catalogPageCount]);

  useEffect(() => {
    catalogScrollRef.current?.scrollTo({ top: 0 });
  }, [catalogPageSafe, catalogTab]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.quantity * i.unit_price - i.discount_amount, 0),
    [cart]
  );
  const activePaymentMethod = payments[0]?.method || paymentMethodDraft;
  const selectedPromotion =
    posSettings.promotions.find((item) => item.id === promotionId && isPromotionValid(item)) || null;
  const quote = useMemo(
    () =>
      quotePosSale({
        subtotal,
        manualDiscount: discount,
        promotion: selectedPromotion,
        cart,
        paymentDiscounts: posSettings.payment_discounts,
        paymentSurcharges: posSettings.payment_surcharges,
        method: activePaymentMethod,
        installments,
      }),
    [
      subtotal,
      discount,
      selectedPromotion,
      cart,
      posSettings.payment_discounts,
      posSettings.payment_surcharges,
      activePaymentMethod,
      installments,
    ]
  );
  const total = quote.total;
  const resolveSaleTotal = useCallback(
    (method: string) =>
      quotePosSale({
        subtotal,
        manualDiscount: discount,
        promotion: selectedPromotion,
        cart,
        paymentDiscounts: posSettings.payment_discounts,
        paymentSurcharges: posSettings.payment_surcharges,
        method,
        installments: method === "cartao_credito" ? installments : 1,
      }).total,
    [subtotal, discount, selectedPromotion, cart, posSettings.payment_discounts, posSettings.payment_surcharges, installments]
  );
  const activePaymentDiscount = quote.paymentRule;

  useEffect(() => {
    if (!selectedPromotion && !activePaymentDiscount) return;
    setDiscount((current) => (Math.abs(current - quote.discount) < 0.009 ? current : quote.discount));
  }, [selectedPromotion, activePaymentDiscount, quote.discount]);
  const paymentsSum = payments.reduce((s, p) => s + p.amount, 0);

  const commissionUserName = useMemo(() => {
    const u = orgMembers.find((m) => m.id === commissionUserId);
    return u?.full_name || u?.email || null;
  }, [orgMembers, commissionUserId]);

  const addProductToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !isListedForSale(product)) return;
    const tier: ProductPriceTier =
      wholesaleEnabled && priceTier === "wholesale" ? "wholesale" : "retail";
    const unitPrice = resolveProductUnitPrice(product, tier);
    const lineKey = `product-${product.id}-${tier}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === lineKey);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: lineKey,
          item_type: "product",
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || "un",
          quantity: 1,
          unit_price: unitPrice,
          category: product.category || null,
          discount_amount: 0,
          stock_quantity: product.stock_quantity,
          price_tier: tier,
        },
      ];
    });
  };

  const pushProductToCart = (product: {
    id: string;
    name: string;
    sku?: string | null;
    unit?: string | null;
    category?: string | null;
    price: number;
    wholesale_price?: number | null;
    stock_quantity?: number | null;
  }) => {
    const tier: ProductPriceTier =
      wholesaleEnabled && priceTier === "wholesale" ? "wholesale" : "retail";
    const unitPrice = resolveProductUnitPrice(product, tier);
    const lineKey = `product-${product.id}-${tier}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === lineKey);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: lineKey,
          item_type: "product" as const,
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || "un",
          category: product.category || null,
          quantity: 1,
          unit_price: unitPrice,
          discount_amount: 0,
          stock_quantity: product.stock_quantity,
          price_tier: tier,
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
    if (!product || !isListedForSale(product)) {
      toast({
        title: product && isSalePaused(product) ? "Venda pausada" : "Código não encontrado",
        description: product && isSalePaused(product)
          ? `${product.name} não entra na Venda Rápida enquanto a venda estiver pausada.`
          : `Nenhum produto com código ${code}`,
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
      category: product.category,
      price: Number(product.price),
      stock_quantity: product.stock_quantity,
    });
    setBarcodeDraft("");
  };

  const addPayment = () => {
    if (!paymentMethodDraft || total <= 0) return;
    const remaining = roundMoney(Math.max(0, total - paymentsSum));
    if (remaining <= 0) return;
    const amount = remaining;
    setPayments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: paymentMethodDraft,
        amount,
        tendered_amount: paymentMethodDraft === "dinheiro" ? amount : null,
        change_amount: 0,
      },
    ]);
    setPaymentMethodDraft("");
  };

  const updatePayment = (id: string, patch: Partial<PosPaymentLine>) => {
    setPayments((prev) =>
      prev.map((payment) => {
        if (payment.id !== id) return payment;
        const next = { ...payment, ...patch };
        if (next.method === "dinheiro") {
          const tendered = Number(next.tendered_amount ?? next.amount);
          next.change_amount = Math.max(0, roundMoney(tendered - Number(next.amount)));
        }
        return next;
      })
    );
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const cashShort = payments.some(
    (payment) =>
      payment.method === "dinheiro" &&
      Number(payment.tendered_amount ?? payment.amount) + 0.001 < Number(payment.amount)
  );
  const paymentsReady =
    payments.length === 0 || (paymentsMatchTotal(paymentsSum, total) && !cashShort);
  const paymentGap = roundMoney(paymentsSum - total);

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setNotes(posSettings.sale_notes || "");
    setAddCommission(posSettings.commission_required);
    setCommissionUserId("");
    setPayments([]);
    setPaymentMethodDraft("");
    setInstallments(1);
    setPromotionId("");
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
    if (!paymentsReady) {
      toast({
        title: cashShort ? "Dinheiro recebido insuficiente" : "A soma das formas não fecha o total",
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
          splitMode: null,
          financeLines: [],
          salePayments: null,
          attachmentName: null,
        }
      );
      return;
    }
    setNextSaleNumberHint("novo");
    setConfirmOpen(true);
  };

  const anyDialogOpen =
    confirmOpen ||
    financeOpen ||
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

  const handleConfirmSale = async (values: PosConfirmSaleValues) => {
    const methodForDiscount =
      values.salePayments?.[0]?.method ||
      payments[0]?.method ||
      values.paymentMethod ||
      paymentMethodDraft ||
      "";
    const confirmedQuote = quotePosSale({
      subtotal,
      manualDiscount: discount,
      promotion: selectedPromotion,
      cart,
      paymentDiscounts: posSettings.payment_discounts,
      paymentSurcharges: posSettings.payment_surcharges,
      method: methodForDiscount,
      installments: methodForDiscount === "cartao_credito" ? installments : 1,
    });
    const saleDiscount = confirmedQuote.discount;
    const saleSurcharge = confirmedQuote.surcharge;
    const saleTotal = confirmedQuote.total;

    let finalPayments: PosPaymentLine[] = [];
    if (values.salePayments?.length) {
      finalPayments = values.salePayments.map((payment) => {
        if (payment.method !== "dinheiro") return payment;
        const existing = payments.find(
          (line) => line.method === "dinheiro" && Math.abs(line.amount - payment.amount) < 0.02
        );
        if (existing?.tendered_amount == null) return payment;
        const tendered = Number(existing.tendered_amount);
        return {
          ...payment,
          tendered_amount: tendered,
          change_amount: Math.max(0, roundMoney(tendered - payment.amount)),
        };
      });
    } else if (payments.length) {
      if (!paymentsMatchTotal(paymentsSum, saleTotal)) {
        toast({
          title: "A soma das formas não fecha o total",
          variant: "destructive",
        });
        return;
      }
      finalPayments = payments;
    } else {
      finalPayments = [
        {
          id: crypto.randomUUID(),
          method: values.paymentMethod || paymentMethodDraft || "pix",
          amount: Number(saleTotal.toFixed(2)),
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
        payments: finalPayments.map((p) => ({
          method: p.method,
          amount: p.amount,
          tendered_amount: p.tendered_amount ?? null,
          change_amount: p.change_amount || 0,
        })),
        finance_lines: values.financeLines,
        attachment_name: values.attachmentName,
        split_mode: values.splitMode,
        discount_amount: saleDiscount,
        surcharge_amount: saleSurcharge,
        promotion_name: selectedPromotion?.name || null,
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
      setLastSaleLeadId(selectedLead?.id || null);
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
      if (values.generateFinancial && result.financial_entries?.length) {
        setFinanceEntries(result.financial_entries);
        setFinanceDescription(values.saleDescription);
        setFinanceOpen(true);
      } else {
        setSuccessOpen(true);
      }
    } catch {
      // toast no hook
    }
  };

  const canOpenConfirm =
    cart.length > 0 &&
    total >= 0 &&
    !!selectedLead &&
    (!(addCommission || posSettings.commission_required) || !!commissionUserId) &&
    paymentsReady &&
    !posLoading;

  return (
    <CRMLayout activeView="pdv" onViewChange={() => {}}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100">
        <div className="flex flex-col gap-2 border-b px-3 py-2 sm:px-4 sm:py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 lg:h-10 lg:w-10"
              title="Configurações do PDV"
              aria-label="Configurações do PDV"
              onClick={() => navigate("/pdv/configuracoes")}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-11 lg:h-9"
              onClick={() => navigate("/pdv/historico")}
            >
              <History className="mr-2 h-4 w-4" />
              Histórico
            </Button>
          </div>

          <div className="relative flex w-full min-w-0 flex-1 items-center gap-2 lg:max-w-lg">
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
                className="h-11 pr-8 text-base lg:h-10 lg:text-sm"
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
              className="h-11 w-11 shrink-0 lg:h-10 lg:w-10"
              title="Criar cliente nesta organização"
              onClick={() => setCreateClientOpen(true)}
              disabled={!activeOrgId}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden flex-nowrap items-center gap-1.5 overflow-x-auto border-b bg-slate-100 px-3 py-2 lg:flex">
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

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,540px)]">
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden bg-white lg:h-full lg:border-r",
              mobilePane === "summary" && "max-lg:hidden"
            )}
          >
            <Tabs
              value={catalogTab}
              onValueChange={(v) => setCatalogTab(v as "products" | "services")}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b px-4 pt-3">
                {wholesaleEnabled ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        catalogTab === "products" && priceTier === "retail"
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      )}
                      onClick={() => {
                        setCatalogTab("products");
                        setPriceTier("retail");
                      }}
                    >
                      Produtos Varejo
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        catalogTab === "products" && priceTier === "wholesale"
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      )}
                      onClick={() => {
                        setCatalogTab("products");
                        setPriceTier("wholesale");
                      }}
                    >
                      Produtos Atacado
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        catalogTab === "services"
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      )}
                      onClick={() => setCatalogTab("services")}
                    >
                      Serviços
                    </button>
                  </div>
                ) : (
                  <TabsList className="h-auto rounded-full bg-slate-100 p-1">
                    <TabsTrigger
                      value="products"
                      className="rounded-full px-4 py-2 data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                    >
                      Produtos
                    </TabsTrigger>
                    <TabsTrigger
                      value="services"
                      className="rounded-full px-4 py-2 data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                    >
                      Serviços
                    </TabsTrigger>
                  </TabsList>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 pb-3">
                  <div className="relative min-w-0 w-full flex-1 sm:w-auto">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      className="h-11 pl-8 text-base lg:h-10 lg:text-sm"
                      placeholder="Buscar"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant={exactSearch ? "default" : "outline"}
                    className="h-11 lg:h-9"
                    onClick={() => setExactSearch((v) => !v)}
                  >
                    Busca Exata
                  </Button>
                  <Button
                    type="button"
                    variant={barcodeMode ? "default" : "outline"}
                    size="icon"
                    className="h-11 w-11 shrink-0 lg:hidden"
                    title="Ler código de barras"
                    aria-label="Leitor de código de barras"
                    onClick={() => {
                      setBarcodeMode((current) => {
                        const next = !current;
                        if (next) setMobilePane("summary");
                        return next;
                      });
                      setCatalogTab("products");
                    }}
                  >
                    <ScanBarcode className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 lg:h-10 lg:w-10"
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
                {catalogTab === "products" && productCategories.length > 0 && !barcodeMode && (
                  <div className="flex gap-1.5 overflow-x-auto pb-3">
                    <button
                      type="button"
                      onClick={() => setCatalogCategory("")}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                        catalogCategory === ""
                          ? "bg-blue-700 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      Todos
                    </button>
                    {productCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setCatalogCategory(category)}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                          catalogCategory === category
                            ? "bg-violet-600 text-white"
                            : "bg-violet-50 text-violet-800 hover:bg-violet-100"
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <TabsContent
                ref={catalogScrollRef}
                value="products"
                className="mt-0 min-h-0 flex-1 overflow-y-auto p-0"
              >
                {productsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    {barcodeMode
                      ? "Modo código de barras ativo. Bipe um produto para ele aparecer aqui."
                      : wholesaleEnabled && priceTier === "wholesale"
                        ? "Nenhum produto com preço de atacado cadastrado (maior que zero)."
                        : "Nenhum produto encontrado."}
                  </p>
                ) : (
                  <ul data-pos-catalog="products">
                    {pagedProducts.map((p, index) => {
                      const code =
                        (posSettings.stock_code_field === "barcode"
                          ? p.barcode || p.sku
                          : p.sku || p.barcode) || "—";
                      return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50",
                            index % 2 === 1 ? "bg-rose-50/70" : "bg-white"
                          )}
                          onClick={() => addProductToCart(p.id)}
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{p.name}</p>
                            <p className="truncate text-xs text-slate-500">Código: {code}</p>
                            <p className={cn("truncate text-xs", stockClass(p.stock_quantity))}>
                              {stockLabel(p.stock_quantity)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-slate-500">
                            {formatMoney(resolveProductUnitPrice(p, wholesaleEnabled ? priceTier : "retail"))}{" "}
                            {p.unit || "Un"}
                          </p>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent
                ref={catalogScrollRef}
                value="services"
                className="mt-0 min-h-0 flex-1 overflow-y-auto p-0"
              >
                {servicesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredServices.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
                ) : (
                  <ul data-pos-catalog="services">
                    {pagedServices.map((s, index) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-amber-50",
                            index % 2 === 1 ? "bg-rose-50/70" : "bg-white"
                          )}
                          onClick={() => addServiceToCart(s.id)}
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            <Wrench className="h-5 w-5 text-slate-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{s.name}</p>
                            {s.category && (
                              <p className="truncate text-xs text-slate-500">{s.category}</p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-medium text-slate-500">
                            {formatMoney(Number(s.price))} Un
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              {catalogTotal > CATALOG_PAGE_SIZE && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-white px-3 py-2">
                  <span className="text-xs text-slate-500">
                    {catalogFrom + 1}–{Math.min(catalogFrom + CATALOG_PAGE_SIZE, catalogTotal)} de {catalogTotal}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={catalogPageSafe <= 1}
                      onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[4.5rem] text-center text-xs font-medium text-slate-700">
                      {catalogPageSafe} / {catalogPageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={catalogPageSafe >= catalogPageCount}
                      onClick={() => setCatalogPage((page) => Math.min(catalogPageCount, page + 1))}
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Tabs>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 lg:h-full lg:border-l lg:shadow-xl",
              mobilePane === "catalog" && "max-lg:hidden"
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 bg-white px-3 pb-2 pt-3 sm:px-5 sm:pt-5">
              <div className="flex min-w-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-2 lg:hidden"
                  onClick={() => setMobilePane("catalog")}
                >
                  Catálogo
                </Button>
                <h2 className="truncate text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  Resumo
                </h2>
              </div>
              <Button
                type="button"
                variant={barcodeMode ? "default" : "outline"}
                size="icon"
                className="h-10 w-10 rounded-xl"
                title={
                  barcodeMode
                    ? "Sair do modo código de barras"
                    : "Ler código de barras — a lista some e só aparecem os produtos bipados"
                }
                aria-label="Leitor de código de barras"
                onClick={() => {
                  setBarcodeMode((current) => {
                    const next = !current;
                    if (next) setMobilePane("summary");
                    return next;
                  });
                  setCatalogTab("products");
                }}
              >
                <ScanBarcode className="h-5 w-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-3 sm:space-y-5 sm:px-5 sm:pb-5">
              <div className="rounded-lg bg-blue-700 px-4 py-2.5 text-center text-white shadow-sm">
                <p className="text-lg font-bold tabular-nums tracking-tight">
                  Total:{" "}
                  {total.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {barcodeMode && (
                <Input
                  ref={barcodeInputRef}
                  className="h-11 rounded-xl bg-white"
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
              )}

              {cart.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-base text-slate-500">
                  Clique em um produto ou serviço para adicionar ao resumo.
                </p>
              ) : (
                <ul className="space-y-4">
                  {cart.map((item) => {
                    const lineTotal = item.quantity * item.unit_price - item.discount_amount;
                    return (
                      <li
                        key={item.key}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <p className="text-base font-bold leading-snug text-slate-900">
                            {item.name}
                            <span className="font-medium text-slate-500">
                              {" "}
                              - {item.unit || "Un"}
                            </span>
                            {item.price_tier === "wholesale" && (
                              <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                                Atacado
                              </span>
                            )}
                          </p>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className="text-base font-bold tabular-nums text-slate-900">
                              {formatMoney(lineTotal)}
                            </span>
                            <Pencil className="h-4 w-4 text-sky-600" />
                            <button type="button" onClick={() => removeCartItem(item.key)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Valor unit:</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-10 rounded-lg bg-white text-base"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateCartItem(item.key, {
                                  unit_price: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Qnt:</Label>
                            <Input
                              type="number"
                              min={0.001}
                              step="1"
                              className="h-10 rounded-lg bg-white text-base"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQty(item.key, Number(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Desconto:</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-10 rounded-lg bg-white text-base"
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
                    className="rounded-lg bg-red-600 text-white hover:bg-red-700"
                    onClick={() => setCart([])}
                  >
                    Limpar Tudo
                  </Button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Promoção</Label>
                  <Select
                    value={promotionId || "__none__"}
                    onValueChange={(value) => setPromotionId(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {posSettings.promotions.filter((item) => isPromotionValid(item)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPromotion ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedPromotion.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      {selectedPromotion.categories.length
                        ? ` nas categorias ${selectedPromotion.categories.join(", ")}`
                        : " em todos os produtos"}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Desconto geral</Label>
                  {activePaymentDiscount ? (
                    <p className="text-xs text-muted-foreground">
                      {activePaymentDiscount.percent}% à vista nesta forma de pagamento
                    </p>
                  ) : null}
                  {quote.surchargeRule ? (
                    <p className="text-xs text-muted-foreground">
                      Acréscimo de {quote.surchargeRule.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      {activePaymentMethod === "cartao_credito" ? ` em ${installments}x` : " à vista"}
                    </p>
                  ) : null}
                  <Input
                    ref={discountInputRef}
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-11 rounded-xl border-slate-200 bg-white text-base"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {posSettings.show_payment_method && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Label className="text-sm font-medium text-slate-700">Formas de pagamento</Label>
                  {payments.map((p) => {
                    const change = Math.max(0, roundMoney(Number(p.tendered_amount || 0) - Number(p.amount)));
                    return (
                      <div
                        key={p.id}
                        className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800">
                            {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}
                          </span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              aria-label={`Valor ${PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}`}
                              className="h-9 w-28 rounded-lg bg-white text-right"
                              value={p.amount}
                              onChange={(event) =>
                                updatePayment(p.id, { amount: Math.max(0, Number(event.target.value) || 0) })
                              }
                            />
                            <button type="button" aria-label="Remover forma" onClick={() => removePayment(p.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {p.method === "dinheiro" ? (
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs">Recebido</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              aria-label="Valor recebido"
                              className="h-9 w-28 rounded-lg bg-white text-right"
                              value={p.tendered_amount ?? ""}
                              onChange={(event) =>
                                updatePayment(p.id, {
                                  tendered_amount: Math.max(0, Number(event.target.value) || 0),
                                })
                              }
                            />
                          </div>
                        ) : null}
                        {p.method === "dinheiro" && change > 0.009 ? (
                          <p className="text-right text-xs font-medium">Troco {formatMoney(change)}</p>
                        ) : null}
                      </div>
                    );
                  })}
                  {payments.length > 0 && Math.abs(paymentGap) > 0.01 ? (
                    <p className="text-xs text-destructive">
                      {paymentGap < 0
                        ? `Falta ${formatMoney(Math.abs(paymentGap))}`
                        : `Passou ${formatMoney(paymentGap)}`}
                    </p>
                  ) : null}
                  {activePaymentMethod === "cartao_credito" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        className="h-10 rounded-lg bg-white"
                        value={installments}
                        onChange={(e) =>
                          setInstallments(Math.min(48, Math.max(1, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                  ) : null}
                  <div className="flex gap-2.5">
                    <Select value={paymentMethodDraft} onValueChange={setPaymentMethodDraft}>
                      <SelectTrigger
                        ref={paymentTriggerRef}
                        className="h-11 flex-1 rounded-xl border-slate-200 bg-white"
                      >
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
                      className="h-11 w-11 shrink-0 rounded-xl"
                      onClick={addPayment}
                      aria-label="Adicionar forma de pagamento"
                      disabled={!paymentMethodDraft || total - paymentsSum <= 0.009}
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
                className="min-h-[72px] rounded-xl border-slate-200 bg-white"
              />

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="add-commission" className="text-sm font-medium text-slate-700">
                    Adicionar comissão
                  </Label>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Usuário vinculado à comissão</Label>
                    <Select value={commissionUserId} onValueChange={setCommissionUserId}>
                      <SelectTrigger className="h-11 rounded-xl bg-white">
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

            <div className="mt-auto shrink-0 space-y-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-5">
              <div className="space-y-1 rounded-lg bg-blue-700 px-3.5 py-2.5 text-white shadow-sm">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">
                    {subtotal.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Desconto:</span>
                  <span className="tabular-nums">
                    {quote.discount.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {quote.surcharge > 0.009 ? (
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Acréscimo:</span>
                    <span className="tabular-nums">
                      {quote.surcharge.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-white/30 pt-1.5 text-base font-bold">
                  <span>Total:</span>
                  <span className="tabular-nums">
                    {total.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
              <div>
                <Button
                  className="h-12 w-full rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 lg:h-10 lg:text-sm"
                  disabled={!canOpenConfirm}
                  onClick={openConfirmDialog}
                >
                  Finalizar
                  <kbd className="ml-2 hidden rounded bg-blue-800 px-1.5 py-0.5 text-[10px] font-bold lg:inline">
                    F12
                  </kbd>
                </Button>
                {!selectedLead && cart.length > 0 && (
                  <p className="mt-1.5 text-center text-xs text-destructive">
                    Selecione ou crie um cliente da organização para continuar
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {mobilePane === "catalog" && (
          <div className="flex shrink-0 border-t bg-white p-2 lg:hidden">
            <Button
              type="button"
              className="h-12 w-full bg-blue-700 text-base text-white hover:bg-blue-800"
              onClick={() => setMobilePane("summary")}
            >
              Resumo{cart.length > 0 ? ` (${cart.length})` : ""} · {formatMoney(total)}
            </Button>
          </div>
        )}
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
        existingPayments={payments}
        resolveTotal={resolveSaleTotal}
        loading={posLoading}
        onConfirm={(values) => void handleConfirmSale(values)}
      />

      <PosFinanceCreatedDialog
        open={financeOpen}
        description={financeDescription}
        entries={financeEntries}
        onDone={() => {
          setFinanceOpen(false);
          setSuccessOpen(true);
        }}
      />

      <PosSaleSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        sale={lastSale}
        items={lastSaleItems}
        payments={lastSalePayments}
        organizationName={orgPrintInfo.name || activeOrganization?.name}
        organization={orgPrintInfo}
        leadId={lastSaleLeadId}
        onNewSale={() => {
          setSuccessOpen(false);
          setLastSale(null);
          setLastSaleLeadId(null);
          resetSale();
        }}
      />
    </CRMLayout>
  );
}
