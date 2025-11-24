import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGmailConfigs } from "@/hooks/useGmailConfigs";
import { useGmailOAuth } from "@/hooks/useGmailOAuth";
import { useGmailMessages } from "@/hooks/useGmailMessages";
import { useGmailReply } from "@/hooks/useGmailReply";
import { Mail, LogIn, RefreshCw, Trash2, Loader2, Search, X, Star, Archive, MoreVertical, Reply, Forward, ArchiveRestore, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function GmailPortal() {
  const { configs, isLoading, deleteConfig, updateConfig, isDeleting } = useGmailConfigs();
  const { initiateOAuth, isLoading: isOAuthLoading } = useGmailOAuth();
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const { data: messagesData, isLoading: isLoadingMessages, refetch } = useGmailMessages(
    selectedConfigId,
    maxResults,
    searchQuery || undefined
  );
  const { mutate: sendReply, isPending: isSendingReply } = useGmailReply();

  const selectedMessage = messagesData?.messages.find(m => m.id === selectedMessageId);

  const handleToggleActive = (config: any) => {
    updateConfig({
      id: config.id,
      updates: { is_active: !config.is_active },
    });
  };

  const handleDelete = (configId: string) => {
    if (confirm("Tem certeza que deseja remover esta conta do Gmail?")) {
      deleteConfig(configId);
      if (selectedConfigId === configId) {
        setSelectedConfigId(null);
        setSelectedMessageId(null);
      }
    }
  };

  const parseEmailAddress = (emailString: string) => {
    const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: emailString, email: emailString };
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } else if (diffInHours < 168) { // 7 dias
      return format(date, "EEEE, HH:mm", { locale: ptBR });
    } else {
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    }
  };

  const handleSendReply = () => {
    if (!selectedMessage || !selectedConfigId || !replyBody.trim()) return;

    sendReply({
      gmail_config_id: selectedConfigId,
      thread_id: selectedMessage.threadId,
      to: selectedMessage.from,
      subject: selectedMessage.subject.startsWith('Re: ') 
        ? selectedMessage.subject 
        : `Re: ${selectedMessage.subject}`,
      body: replyBody,
      in_reply_to: selectedMessage.id,
    }, {
      onSuccess: () => {
        setReplyBody("");
        setIsReplying(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Mail className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Nenhuma conta do Gmail configurada</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Conecte sua conta do Gmail para visualizar seus emails em tempo real.
        </p>
        <Button 
          onClick={() => initiateOAuth()}
          disabled={isOAuthLoading}
          className="bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {isOAuthLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Conectar Gmail
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - Barra de busca e configurações */}
      <div className="border-b bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Select
            value={selectedConfigId || ""}
            onValueChange={(value) => {
              setSelectedConfigId(value || null);
              setSelectedMessageId(null);
            }}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  <div className="flex items-center gap-2">
                    <span>{config.account_name}</span>
                    {!config.is_active && (
                      <Badge variant="secondary" className="text-xs">Inativa</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedConfig && (
            <div className="flex items-center gap-2">
              <Badge variant={selectedConfig.is_active ? "default" : "secondary"}>
                {selectedConfig.is_active ? "Ativa" : "Inativa"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleActive(selectedConfig)}
                className="h-8"
              >
                {selectedConfig.is_active ? "Desativar" : "Ativar"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(selectedConfig.id)}
                disabled={isDeleting}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover e Reconectar
              </Button>
            </div>
          )}

          {!selectedConfigId && (
            <Button 
              onClick={() => initiateOAuth()}
              disabled={isOAuthLoading}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              {isOAuthLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Conectar Gmail
                </>
              )}
            </Button>
          )}
        </div>

        {selectedConfig && (
          <div className="flex items-center gap-2">
            <div className="relative w-[500px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar emails"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={maxResults.toString()}
              onValueChange={(value) => setMaxResults(parseInt(value))}
            >
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoadingMessages}
              className="h-9"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      {/* Conteúdo principal - Layout Gmail style */}
      {selectedConfig ? (
        isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messagesData?.messages && messagesData.messages.length > 0 ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Lista de emails - Estilo Gmail */}
            <div className="w-1/2 border-r overflow-y-auto bg-white dark:bg-gray-900">
              <div className="text-xs text-muted-foreground px-4 py-2 border-b flex items-center justify-between">
                <span>
                  Página {currentPage} • {messagesData.messages.length} de {messagesData.resultSizeEstimate} emails
                </span>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(p => p - 1);
                        setSelectedMessageId(null);
                      }}
                      className="h-6 text-xs"
                    >
                      Anterior
                    </Button>
                  )}
                  {messagesData.messages.length === maxResults && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(p => p + 1);
                        setSelectedMessageId(null);
                      }}
                      className="h-6 text-xs"
                    >
                      Próxima
                    </Button>
                  )}
                </div>
              </div>
              {messagesData.messages.map((message) => {
                const from = parseEmailAddress(message.from);
                const date = message.date ? new Date(message.date) : null;
                const isUnread = message.labels.includes("UNREAD");
                const isImportant = message.labels.includes("IMPORTANT");
                const isSelected = selectedMessageId === message.id;
                
                return (
                  <div
                    key={message.id}
                    onClick={() => setSelectedMessageId(message.id)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                      isSelected && "bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500",
                      isUnread && "bg-white dark:bg-gray-900"
                    )}
                  >
                    <div className="flex-shrink-0 pt-1">
                      {isImportant ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            "font-medium truncate",
                            isUnread ? "font-semibold" : "font-normal"
                          )}>
                            {from.name}
                          </span>
                        </div>
                        {date && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-sm truncate",
                          isUnread ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
                        )}>
                          {message.subject || "(Sem assunto)"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {message.snippet}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Preview do email selecionado */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
              {selectedMessage ? (
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-normal mb-2">
                          {selectedMessage.subject || "(Sem assunto)"}
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {parseEmailAddress(selectedMessage.from).name}
                          </span>
                          <span>&lt;{parseEmailAddress(selectedMessage.from).email}&gt;</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Para: {selectedMessage.to}
                        </div>
                        {selectedMessage.date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(selectedMessage.date), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setIsReplying(!isReplying)}
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Forward className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-6">
                    <div className="prose dark:prose-invert max-w-none">
                      {selectedMessage.body ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {selectedMessage.body}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {selectedMessage.snippet}
                        </div>
                      )}
                    </div>
                  </div>

                  {isReplying && (
                    <div className="border-t mt-6 pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">Responder</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsReplying(false);
                              setReplyBody("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Para: {parseEmailAddress(selectedMessage.from).email}
                        </div>
                        <Textarea
                          placeholder="Digite sua resposta..."
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          className="min-h-[200px]"
                        />
                        <div className="flex justify-end">
                          <Button
                            onClick={handleSendReply}
                            disabled={!replyBody.trim() || isSendingReply}
                          >
                            {isSendingReply ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione um email para visualizar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhum email encontrado</p>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Selecione uma conta do Gmail para visualizar emails</p>
          </div>
        </div>
      )}

      {/* Alert de segurança */}
      <div className="border-t bg-muted/50 px-4 py-2">
        <Alert className="border-0 bg-transparent p-0">
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>Segurança:</strong> Nenhum email é armazenado permanentemente. Apenas tokens OAuth são salvos.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
