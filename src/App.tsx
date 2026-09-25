import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Loader2 } from "lucide-react";
import { initializeRealtime } from "@/utils/realtimeInit";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActiveOrganizationProvider } from "@/contexts/ActiveOrganizationProvider";

// Páginas críticas (Index=funil + Login) carregam eager para não ter spinner nas rotas mais usadas.
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Demais páginas: lazy-loaded — cada rota vira seu próprio chunk JS, carregado sob demanda.
// Reduz bundle inicial de ~4.7 MB para chunks pequenos por feature.
const Users = lazyWithRetry(() => import("./pages/Users"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const BroadcastCampaigns = lazyWithRetry(() => import("./pages/BroadcastCampaigns"));
const BroadcastCampaigns2 = lazyWithRetry(() => import("./pages/BroadcastCampaignsHub"));
const PeriodicWorkflows = lazyWithRetry(() => import("./pages/PeriodicWorkflows"));
const AuthLogs = lazyWithRetry(() => import("./pages/AuthLogs"));
const Diagnostics = lazyWithRetry(() => import("./pages/Diagnostics"));
const Organization = lazyWithRetry(() => import("./pages/Organization"));
const SuperAdmin = lazyWithRetry(() => import("./pages/SuperAdmin"));
const SuperAdminCosts = lazyWithRetry(() => import("./pages/SuperAdminCosts"));
const SuperAdminVersions = lazyWithRetry(() => import("./pages/SuperAdminVersions"));
const SuperAdminAgilizeProdutos = lazyWithRetry(() => import("./pages/SuperAdminAgilizeProdutos"));
const SuperAdminAgilizeClientes = lazyWithRetry(() => import("./pages/SuperAdminAgilizeClientes"));
const SuperAdminChatwoot = lazyWithRetry(() => import("./pages/SuperAdminChatwoot"));
const AgentsDashboard = lazyWithRetry(() => import("./pages/AgentsDashboard"));
const RLSDiagnostics = lazyWithRetry(() => import("./pages/RLSDiagnostics"));
const NovaFuncao = lazyWithRetry(() => import("./pages/NovaFuncao"));
const BubbleIntegration = lazyWithRetry(() => import("./pages/BubbleIntegration"));
const N8nIntegration = lazyWithRetry(() => import("./pages/N8nIntegration"));
const Calendar = lazyWithRetry(() => import("./pages/Calendar"));
const CRM = lazyWithRetry(() => import("./pages/CRM"));
const Gmail = lazyWithRetry(() => import("./pages/Gmail"));
const FormBuilder = lazyWithRetry(() => import("./pages/FormBuilder"));
const AutomationFlows = lazyWithRetry(() => import("./pages/AutomationFlows"));
const GoogleBusinessPosts = lazyWithRetry(() => import("./pages/GoogleBusinessPosts"));
const PostSale = lazyWithRetry(() => import("./pages/PostSale"));
const AgilizeEmbed = lazyWithRetry(() => import("./pages/AgilizeEmbed"));
const Assistant = lazyWithRetry(() => import("./pages/Assistant"));
const ReconnectInstance = lazyWithRetry(() => import("./pages/ReconnectInstance"));
const Cadastro = lazyWithRetry(() => import("./pages/Cadastro"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const MessagesCenter = lazyWithRetry(() => import("./pages/MessagesCenter"));
const Contracts = lazyWithRetry(() => import("./pages/Contracts"));
const ContractsNewSafe = lazyWithRetry(() => import("./pages/ContractsNewSafe"));
const BudgetsModule = lazyWithRetry(() => import("./pages/BudgetsModule"));
const SignContract = lazyWithRetry(() => import("./pages/SignContract"));
const Budgets = lazyWithRetry(() => import("./pages/Budgets"));
const Pos = lazyWithRetry(() => import("./pages/Pos"));
const Estoque = lazyWithRetry(() => import("./pages/Estoque"));
const PosSalesHistory = lazyWithRetry(() => import("./pages/PosSalesHistory"));
const PosSettings = lazyWithRetry(() => import("./pages/PosSettings"));
const ServiceOrders = lazyWithRetry(() => import("./pages/ServiceOrders"));
const FinanceDashboard = lazyWithRetry(() => import("./pages/FinanceDashboard"));
const FinanceReceivables = lazyWithRetry(() => import("./pages/FinanceReceivables"));
const FinancePayables = lazyWithRetry(() => import("./pages/FinancePayables"));
const Employees = lazyWithRetry(() => import("./pages/Employees"));
const PublicSurvey = lazyWithRetry(() => import("./pages/PublicSurvey"));
const PublicBooking = lazyWithRetry(() => import("./pages/PublicBooking"));
const DigitalContracts = lazyWithRetry(() => import("./pages/DigitalContracts"));
const DigitalContractsNew = lazyWithRetry(() => import("./pages/DigitalContractsNew"));
const DigitalContractView = lazyWithRetry(() => import("./pages/DigitalContractView"));
const DigitalContractSign = lazyWithRetry(() => import("./pages/DigitalContractSign"));
const LandingPageAdmin = lazyWithRetry(() => import("./pages/LandingPageAdmin"));
const LandingPagePublic = lazyWithRetry(() => import("./pages/LandingPagePublic"));
const WordPressContent = lazyWithRetry(() => import("./pages/WordPressContent"));

// QueryClient com cache apropriado — EVITA refetch a cada navegação entre páginas.
// Antes: staleTime=0 → TODA troca de rota refazia todas as queries do zero (~200-500ms por tela).
// Agora: staleTime 2min → dados frescos reaproveitados entre navegações; gcTime 10min.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 minutos
      gcTime: 10 * 60 * 1000,          // 10 minutos em cache
      refetchOnWindowFocus: false,     // evita burst de queries ao voltar a aba
      refetchOnMount: false,           // usa cache se estiver fresh
      retry: 1,                         // falhas de rede: 1 retry (não 3 = default)
    },
  },
});

// Spinner leve usado em transições de página (lazy chunks).
const PageSpinner = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  // Realtime só após haver sessão — evita WebSocket/erros na landing e acelera primeiro ecrã
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRealtime = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) {
          console.log("🚀 Aplicação carregada. Inicializando Realtime (utilizador autenticado)...");
          initializeRealtime();
        }
      }, 600);
    };

    const tryInitFromSession = (session: unknown) => {
      if (session) scheduleRealtime();
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      tryInitFromSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION")
      ) {
        tryInitFromSession(session);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ActiveOrganizationProvider>
              <Suspense fallback={<PageSpinner />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/broadcast" element={<BroadcastCampaigns />} />
                <Route path="/broadcast-2" element={<BroadcastCampaigns2 />} />
                <Route path="/workflows" element={<PeriodicWorkflows />} />
                <Route path="/auth-logs" element={<AuthLogs />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/organization" element={<Organization />} />
                <Route path="/superadmin" element={<SuperAdmin />} />
                <Route path="/superadmin/costs" element={<SuperAdminCosts />} />
                <Route path="/superadmin/versions" element={<SuperAdminVersions />} />
                <Route path="/superadmin/agilize-produtos" element={<SuperAdminAgilizeProdutos />} />
                <Route path="/superadmin/agilize-clientes" element={<SuperAdminAgilizeClientes />} />
                <Route path="/superadmin/chatwoot" element={<SuperAdminChatwoot />} />
                <Route path="/rls-diagnostics" element={<RLSDiagnostics />} />
                <Route path="/lista-telefonica" element={<NovaFuncao />} />
                <Route path="/bubble" element={<BubbleIntegration />} />
                <Route path="/n8n" element={<N8nIntegration />} />
                <Route path="/agents" element={<AgentsDashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/messages-center" element={<MessagesCenter />} />
                <Route path="/gmail" element={<Gmail />} />
                <Route path="/form-builder" element={<FormBuilder />} />
                <Route path="/automation-flows" element={<AutomationFlows />} />
                <Route path="/google-business-posts" element={<GoogleBusinessPosts />} />
                <Route path="/post-sale" element={<PostSale />} />
                <Route path="/agilize" element={<AgilizeEmbed />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/contracts" element={<Contracts />} />
                <Route path="/contracts/new-safe" element={<ContractsNewSafe />} />
                <Route path="/contracts/new-safe-v2" element={<ContractsNewSafe />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/pdv" element={<Pos />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/pdv/historico" element={<PosSalesHistory />} />
                <Route path="/pdv/configuracoes" element={<PosSettings />} />
                <Route path="/service-orders" element={<ServiceOrders />} />
                <Route path="/financeiro" element={<FinanceDashboard />} />
                <Route path="/financeiro/receber" element={<FinanceReceivables />} />
                <Route path="/financeiro/pagar" element={<FinancePayables />} />
                <Route path="/budgets-module" element={<BudgetsModule />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/sign-contract/:contractId" element={<SignContract />} />
                <Route path="/sign-contract/:contractId/:token" element={<SignContract />} />
                <Route path="/contratos-digitais" element={<DigitalContracts />} />
                <Route path="/contratos-digitais/novo" element={<DigitalContractsNew />} />
                <Route path="/contratos-digitais/:id" element={<DigitalContractView />} />
                <Route path="/contratos-digitais/assinar/:contractId" element={<DigitalContractSign />} />
                <Route path="/contratos-digitais/assinar/:contractId/:token" element={<DigitalContractSign />} />
                <Route path="/reconnect/:notificationId" element={<ReconnectInstance />} />
                <Route path="/reconnect-instance/:instanceId" element={<ReconnectInstance />} />
                <Route path="/survey/:slug" element={<PublicSurvey />} />
                <Route path="/book/:organizationSlug" element={<PublicBooking />} />
                <Route path="/admin/landing-page" element={<LandingPageAdmin />} />
                <Route path="/wordpress-conteudo" element={<WordPressContent />} />
                <Route path="/p/:slug" element={<LandingPagePublic />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ActiveOrganizationProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
