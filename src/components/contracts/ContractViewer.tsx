import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Contract, ContractSignature } from '@/types/contract';
import { format } from 'date-fns';
import { ContractStatusBadge } from './ContractStatusBadge';
import { useContractSignatures } from '@/hooks/useContractSignatures';
import { Download, FileSignature, Send, X, MessageSquare, ChevronDown, ChevronUp, Shield, Globe, Monitor, Hash, FileText, Settings } from 'lucide-react';
import { GoogleDriveBackupButton } from './GoogleDriveBackupButton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContractReminders } from './ContractReminders';
import { ContractAuditLog } from './ContractAuditLog';

interface ContractViewerProps {
  contract: Contract;
  onSign?: (contract: Contract) => void;
  onSend?: (contract: Contract) => void;
  onCancel?: (contract: Contract) => void;
  onDownload?: (contract: Contract) => void;
  onEditMessage?: (contract: Contract) => void;
  onEditTemplate?: (template: ContractTemplate) => void;
  onConfigureSignatures?: (contract: Contract) => void;
}

export function ContractViewer({
  contract,
  onSign,
  onSend,
  onCancel,
  onDownload,
  onEditMessage,
  onEditTemplate,
  onConfigureSignatures,
}: ContractViewerProps) {
  const { signatures, loading: signaturesLoading } = useContractSignatures(contract.id);
  const [expandedSignatures, setExpandedSignatures] = useState<Set<string>>(new Set());

  const pdfUrl = contract.signed_pdf_url || contract.pdf_url;
  
  const toggleSignatureAuth = (signatureId: string) => {
    setExpandedSignatures(prev => {
      const next = new Set(prev);
      if (next.has(signatureId)) {
        next.delete(signatureId);
      } else {
        next.add(signatureId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Informações do Contrato */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contrato {contract.contract_number}</CardTitle>
              <CardDescription>
                Criado em {format(new Date(contract.created_at), 'dd/MM/yyyy HH:mm')}
              </CardDescription>
            </div>
            <ContractStatusBadge status={contract.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cliente</p>
              <p className="text-sm">{contract.lead?.name || 'N/A'}</p>
              {contract.lead?.phone && (
                <p className="text-xs text-muted-foreground">{contract.lead.phone}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Template</p>
              <div className="flex items-center gap-2">
                <p className="text-sm">{contract.template?.name || 'N/A'}</p>
                {contract.template && onEditTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onEditTemplate(contract.template!)}
                    title="Editar template"
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {contract.expires_at && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Vigência</p>
                <p className="text-sm">{format(new Date(contract.expires_at), 'dd/MM/yyyy')}</p>
              </div>
            )}
            {contract.signed_at && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Assinatura</p>
                <p className="text-sm">{format(new Date(contract.signed_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            )}
            {contract.sent_at && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Envio</p>
                <p className="text-sm">{format(new Date(contract.sent_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Card destacado para editar mensagem WhatsApp - SEMPRE VISÍVEL */}
          <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <p className="font-semibold text-primary">Mensagem WhatsApp Personalizada</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Personalize a mensagem que será enviada junto com o contrato e link de assinatura
                </p>
                {contract.whatsapp_message_template ? (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Mensagem personalizada configurada
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Use a mensagem padrão ou personalize abaixo
                  </p>
                )}
              </div>
              {onEditMessage ? (
                <Button 
                  variant="default" 
                  onClick={() => onEditMessage(contract)}
                  className="ml-4"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {contract.whatsapp_message_template ? 'Editar Mensagem' : 'Configurar Mensagem'}
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  disabled
                  className="ml-4"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Configurar Mensagem
                </Button>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 flex-wrap">
            {onDownload && pdfUrl && (
              <Button variant="outline" onClick={() => onDownload(contract)}>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            )}
            {onSign && (() => {
              // Verificar se o usuário já assinou
              // IMPORTANTE: O usuário pode assinar mesmo que o cliente já tenha assinado primeiro
              const userHasSigned = signatures.some(sig => sig.signer_type === 'user');
              console.log('🔍 [ContractViewer] Verificando assinaturas:', {
                contractId: contract.id,
                totalSignatures: signatures.length,
                signatures: signatures.map(s => ({ type: s.signer_type, name: s.signer_name })),
                userHasSigned,
                shouldShowButton: !userHasSigned
              });
              // Mostrar botão se o usuário ainda não assinou, independente do status ou se cliente já assinou
              return !userHasSigned;
            })() && (
              <Button onClick={() => onSign(contract)}>
                <FileSignature className="w-4 h-4 mr-2" />
                Assinar
              </Button>
            )}
            {onConfigureSignatures && (
              <Button variant="outline" onClick={() => onConfigureSignatures(contract)}>
                <Settings className="w-4 h-4 mr-2" />
                Configurar Assinaturas
              </Button>
            )}
            {onSend && contract.status === 'signed' && (
              <Button variant="default" onClick={() => onSend(contract)}>
                <Send className="w-4 h-4 mr-2" />
                Enviar ao Cliente
              </Button>
            )}
            {onCancel && contract.status !== 'cancelled' && (
              <Button variant="destructive" onClick={() => onCancel(contract)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visualização do PDF */}
      {pdfUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Visualização do Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              src={pdfUrl}
              className="w-full h-[600px] border rounded-lg"
              title="Contrato PDF"
            />
          </CardContent>
        </Card>
      )}

      {/* Assinaturas */}
      {signatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas</CardTitle>
            <CardDescription>
              {signatures.length} assinatura(s) coletada(s) com dados de autenticação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signatures.map((signature) => {
                const hasAuthData = !!(signature.ip_address || signature.user_agent || signature.validation_hash);
                const isExpanded = expandedSignatures.has(signature.id);
                
                return (
                  <div key={signature.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-start gap-4 p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{signature.signer_name}</p>
                          <Badge variant="outline">
                            {signature.signer_type === 'user' ? 'Usuário' : 'Cliente'}
                          </Badge>
                          {hasAuthData && (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Autenticado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Assinado em {format(new Date(signature.signed_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                        
                        {/* Dados de Autenticação ao lado da assinatura */}
                        {hasAuthData && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3 bg-muted/30 rounded-lg border border-muted">
                            {signature.ip_address && (
                              <div className="flex items-start gap-2">
                                <Globe className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground">IP</p>
                                  <p className="text-sm font-mono break-all">{signature.ip_address}</p>
                                  {signature.signed_ip_country && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {signature.signed_ip_country}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {signature.user_agent && (
                              <div className="flex items-start gap-2">
                                <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground">Navegador</p>
                                  <p className="text-sm break-all line-clamp-2">
                                    {signature.user_agent.length > 60 
                                      ? `${signature.user_agent.substring(0, 60)}...` 
                                      : signature.user_agent}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {signature.validation_hash && (
                              <div className="flex items-start gap-2 md:col-span-2">
                                <Hash className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground">Hash de Validação</p>
                                  <p className="text-xs font-mono break-all text-muted-foreground">
                                    {signature.validation_hash}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="border rounded p-2 bg-white flex-shrink-0">
                        <img
                          src={signature.signature_data}
                          alt={`Assinatura de ${signature.signer_name}`}
                          className="h-20 w-auto"
                        />
                      </div>
                    </div>
                    
                    {/* Dados Detalhados de Autenticação (Expandível) */}
                    {hasAuthData && (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleSignatureAuth(signature.id)}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between rounded-none border-t"
                          >
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Ver Detalhes Completos de Autenticação
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 bg-muted/50 space-y-3 text-sm">
                            {signature.user_agent && (
                              <div className="flex items-start gap-2">
                                <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="font-medium">User Agent Completo</p>
                                  <p className="text-muted-foreground text-xs break-all">
                                    {signature.user_agent}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {signature.device_info && (
                              <div className="flex items-start gap-2">
                                <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">Informações do Dispositivo</p>
                                  <div className="text-xs text-muted-foreground space-y-1 mt-1">
                                    {signature.device_info.platform && (
                                      <p>Plataforma: {signature.device_info.platform}</p>
                                    )}
                                    {signature.device_info.language && (
                                      <p>Idioma: {signature.device_info.language}</p>
                                    )}
                                    {signature.device_info.screenWidth && (
                                      <p>
                                        Resolução: {signature.device_info.screenWidth}x{signature.device_info.screenHeight}
                                      </p>
                                    )}
                                    {signature.device_info.timezone && (
                                      <p>Fuso Horário: {signature.device_info.timezone}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {signature.validation_hash && (
                              <div className="flex items-start gap-2">
                                <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="font-medium">Hash de Validação (SHA-256)</p>
                                  <p className="text-muted-foreground text-xs font-mono break-all">
                                    {signature.validation_hash}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Este hash garante a integridade da assinatura e pode ser usado para validação forense
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Drive Backup */}
      {contract.lead_id && (
        <Card>
          <CardHeader>
            <CardTitle>Backup no Google Drive</CardTitle>
            <CardDescription>
              Salve o contrato assinado no Google Drive do cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleDriveBackupButton
              contract={contract}
              onSuccess={() => {
                // Atualizar visualização se necessário
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Lembretes Automáticos */}
      <ContractReminders contractId={contract.id} />

      {/* Histórico de Auditoria */}
      <ContractAuditLog contractId={contract.id} />
    </div>
  );
}
