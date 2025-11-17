import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import BroadcastCampaigns from "./pages/BroadcastCampaigns";
import WhatsApp from "./pages/WhatsApp";
import PeriodicWorkflows from "./pages/PeriodicWorkflows";
import AuthLogs from "./pages/AuthLogs";
import Diagnostics from "./pages/Diagnostics";
import Organization from "./pages/Organization";
import SuperAdmin from "./pages/SuperAdmin";
import SuperAdminCosts from "./pages/SuperAdminCosts";
import AgentsDashboard from "./pages/AgentsDashboard";
import RLSDiagnostics from "./pages/RLSDiagnostics";
import NovaFuncao from "./pages/NovaFuncao";
import Calendar from "./pages/Calendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/broadcast" element={<BroadcastCampaigns />} />
          <Route path="/whatsapp" element={<WhatsApp />} />
          <Route path="/workflows" element={<PeriodicWorkflows />} />
          <Route path="/auth-logs" element={<AuthLogs />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/organization" element={<Organization />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/superadmin/costs" element={<SuperAdminCosts />} />
          <Route path="/rls-diagnostics" element={<RLSDiagnostics />} />
          <Route path="/lista-telefonica" element={<NovaFuncao />} />
          <Route path="/agents" element={<AgentsDashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
