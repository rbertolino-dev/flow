import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CalendarView } from "@/components/calendar/CalendarView";
import { GoogleCalendarIntegrationPanel } from "@/components/calendar/GoogleCalendarIntegrationPanel";
import { CalendarMessageTemplatesPanel } from "@/components/calendar/CalendarMessageTemplatesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Settings, BarChart3, MessageSquare } from "lucide-react";
import { CalendarEventsReport } from "@/components/calendar/CalendarEventsReport";

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState("calendar");

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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Agenda
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Relatórios
                </TabsTrigger>
                <TabsTrigger value="integration" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Integração
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="mt-6">
                <CalendarView />
              </TabsContent>

              <TabsContent value="templates" className="mt-6">
                <CalendarMessageTemplatesPanel />
              </TabsContent>

              <TabsContent value="reports" className="mt-6">
                <CalendarEventsReport />
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

