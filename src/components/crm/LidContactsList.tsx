import { useState } from "react";
import { useLidContacts, LidContact } from "@/hooks/useLidContacts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, UserPlus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConvertLidDialog } from "./ConvertLidDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LidContactsList() {
  const { lidContacts, loading, deleteLidContact, refetch } = useLidContacts();
  const [selectedContact, setSelectedContact] = useState<LidContact | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const handleConvert = (contact: LidContact) => {
    setSelectedContact(contact);
    setConvertDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteLidContact(id);
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (lidContacts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Nenhum contato LID</h2>
          <p className="text-muted-foreground">
            Contatos de WhatsApp Business e Canais aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full bg-background p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Contatos LID</h1>
          <p className="text-muted-foreground">
            WhatsApp Business e Canais Oficiais ({lidContacts.length})
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lidContacts.map((contact) => (
            <Card key={contact.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{contact.name}</h3>
                  <Badge variant="secondary" className="mt-1">
                    WhatsApp Business
                  </Badge>
                </div>
                {contact.profile_pic_url && (
                  <img
                    src={contact.profile_pic_url}
                    alt={contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate font-mono text-xs">{contact.lid}</span>
                </div>
                {contact.last_contact && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs">
                      {format(contact.last_contact, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {contact.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                    {contact.notes}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleConvert(contact)}
                  className="flex-1"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Converter
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover contato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O contato LID será removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(contact.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <ConvertLidDialog
        lidContact={selectedContact}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConverted={refetch}
      />
    </>
  );
}
