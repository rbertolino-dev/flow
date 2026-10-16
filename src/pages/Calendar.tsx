import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CalendarView } from "@/components/calendar/CalendarView";
import { GoogleCalendarIntegrationPanel } from "@/components/calendar/GoogleCalendarIntegrationPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Settings,
  BarChart3,
  FileText,
  CheckCircle2,
  Link as LinkIcon,
  Clock,
  Palette,
} from "lucide-react";
import { CalendarEventsReport } from "@/components/calendar/CalendarEventsReport";
import { BookedMeetingsReport } from "@/components/calendar/BookedMeetingsReport";
import { CalendarMessageTemplateManager } from "@/components/calendar/CalendarMessageTemplateManager";
import { BookingApprovalQueue } from "@/components/calendar/BookingApprovalQueue";
import { BookingConfigPanel } from "@/components/calendar/BookingConfigPanel";
import { UserAvailabilitySettings } from "@/components/calendar/UserAvailabilitySettings";
import { BookingTemplatesSettings } from "@/components/calendar/BookingTemplatesSettings";
import { CalendarColorStatusSettings } from "@/components/calendar/CalendarColorStatusSettings";

const VALID_TABS = new Set([
  "calendar",
  "reports",
  "templates",
  "approval",
  "availability",
  "public-link",
  "cores-status",
  "integration",
]);

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "calendar";
  const [activeTab, setActiveTab] = useState(
    VALID_TABS.has(tabFromUrl) ? tabFromUrl : "calendar",
  );

  useEffect(() => {
    const next = searchParams.get("tab") || "calendar";
    if (VALID_TABS.has(next) && next !== activeTab) {
      setActiveTab(next);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "calendar") {
      next.delete("tab");
    } else {
      next.set("tab", value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="calendar" onViewChange={() => {}}>
        <div className="h-full overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Agendamento</h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie seus eventos e compromissos do Google Calendar
                </p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex h-auto min-w-full w-max justify-start gap-1 p-1">
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Agenda
                  </TabsTrigger>
                  <TabsTrigger value="cores-status" className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Cores e Status
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Relatórios
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Templates
                  </TabsTrigger>
                  <TabsTrigger value="approval" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Aprovações
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Disponibilidade
                  </TabsTrigger>
                  <TabsTrigger value="public-link" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Link Público
                  </TabsTrigger>
                  <TabsTrigger value="integration" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Integração
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="calendar" className="mt-6">
                <CalendarView />
              </TabsContent>

              <TabsContent value="cores-status" className="mt-6">
                <CalendarColorStatusSettings />
              </TabsContent>

              <TabsContent value="reports" className="mt-6">
                <div className="space-y-6">
                  <Tabs defaultValue="by-person" className="w-full">
                    <TabsList>
                      <TabsTrigger value="by-person">Por Pessoa</TabsTrigger>
                      <TabsTrigger value="by-stage">Por Etiqueta</TabsTrigger>
                    </TabsList>
                    <TabsContent value="by-person" className="mt-6">
                      <BookedMeetingsReport />
                    </TabsContent>
                    <TabsContent value="by-stage" className="mt-6">
                      <CalendarEventsReport />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              <TabsContent value="templates" className="mt-6">
                <CalendarMessageTemplateManager />
              </TabsContent>

              <TabsContent value="approval" className="mt-6">
                <BookingApprovalQueue />
              </TabsContent>

              <TabsContent value="availability" className="mt-6">
                <UserAvailabilitySettings />
              </TabsContent>

              <TabsContent value="public-link" className="mt-6">
                <div className="space-y-6">
                  <BookingConfigPanel />
                  <BookingTemplatesSettings />
                </div>
              </TabsContent>

              <TabsContent value="integration" className="mt-6">
                <GoogleCalendarIntegrationPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
