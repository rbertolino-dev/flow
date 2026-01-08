import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Clock, User, Phone, Mail, MessageSquare, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface BookingRequest {
  id: string;
  organization_id: string;
  user_id: string | null;
  requested_datetime: string;
  duration_minutes: number;
  client_name: string;
  client_email: string | null;
  client_phone: string;
  client_notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  google_event_id: string | null;
  calendar_event_id: string | null;
  confirmation_sent_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export function BookingApprovalQueue() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [addGoogleMeet, setAddGoogleMeet] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    if (activeOrgId) {
      loadBookingRequests();
    }
  }, [activeOrgId]);

  const loadBookingRequests = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_requests')
        .select(`
          *,
          user:profiles!booking_requests_user_id_fkey(id, full_name, email)
        `)
        .eq('organization_id', activeOrgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setBookingRequests((data || []) as BookingRequest[]);
    } catch (error: any) {
      console.error('Erro ao carregar solicitações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar solicitações de agendamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: BookingRequest) => {
    try {
      setApproving(true);
      setSelectedRequest(request);

      const { data, error } = await supabase.functions.invoke('approve-booking', {
        body: {
          booking_request_id: request.id,
          action: 'approve',
          add_google_meet: addGoogleMeet,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Aprovado!",
        description: "Solicitação aprovada e evento criado no Google Calendar",
      });

      await loadBookingRequests();
      setSelectedRequest(null);
      setAddGoogleMeet(false);
    } catch (error: any) {
      console.error('Erro ao aprovar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao aprovar solicitação",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      setRejecting(true);

      const { data, error } = await supabase.functions.invoke('approve-booking', {
        body: {
          booking_request_id: selectedRequest.id,
          action: 'reject',
          rejection_reason: rejectionReason || undefined,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Rejeitado",
        description: "Solicitação rejeitada",
      });

      await loadBookingRequests();
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (error: any) {
      console.error('Erro ao rejeitar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao rejeitar solicitação",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bookingRequests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma solicitação pendente de aprovação</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fila de Aprovação</h2>
          <p className="text-muted-foreground">
            {bookingRequests.length} solicitação(ões) aguardando aprovação
          </p>
        </div>
      </div>

      {bookingRequests.map((request) => {
        const { date, time } = formatDateTime(request.requested_datetime);

        return (
          <Card key={request.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {request.client_name}
                  </CardTitle>
                  <CardDescription className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{date.charAt(0).toUpperCase() + date.slice(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{time}</span>
                      <span className="text-xs">({request.duration_minutes} minutos)</span>
                    </div>
                    {request.user && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Responsável: {request.user.full_name || request.user.email}</span>
                      </div>
                    )}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-yellow-50">
                  <Clock className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {request.client_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{request.client_email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{request.client_phone}</span>
                  </div>
                </div>

                {request.client_notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="font-semibold">Observações:</p>
                      <p className="text-gray-600">{request.client_notes}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    onClick={() => {
                      setSelectedRequest(request);
                      setAddGoogleMeet(false);
                      handleApprove(request);
                    }}
                    disabled={approving && selectedRequest?.id === request.id}
                    className="flex-1"
                  >
                    {approving && selectedRequest?.id === request.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aprovando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRejectDialog(true);
                    }}
                    disabled={rejecting}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeitar
                  </Button>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id={`meet-${request.id}`}
                    checked={addGoogleMeet}
                    onCheckedChange={(checked) => setAddGoogleMeet(checked as boolean)}
                  />
                  <Label htmlFor={`meet-${request.id}`} className="text-sm cursor-pointer">
                    Adicionar Google Meet ao evento
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Deseja rejeitar a solicitação de agendamento? Você pode adicionar um motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição (opcional)</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Horário não disponível, conflito de agenda..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejeitando...
                </>
              ) : (
                "Rejeitar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

