import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGoogleBusinessPosts } from "@/hooks/useGoogleBusinessPosts";
import { useGoogleBusinessConfigs } from "@/hooks/useGoogleBusinessConfigs";
import { Loader2, Plus, X, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateGoogleBusinessPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGoogleBusinessPostDialog({
  open,
  onOpenChange,
}: CreateGoogleBusinessPostDialogProps) {
  const { toast } = useToast();
  const { createPost, isCreating } = useGoogleBusinessPosts();
  const { configs } = useGoogleBusinessConfigs();
  const [shouldReset, setShouldReset] = useState(false);
  const [postType, setPostType] = useState<'UPDATE' | 'EVENT' | 'OFFER' | 'PRODUCT'>('UPDATE');
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [callToActionType, setCallToActionType] = useState<'CALL' | 'BOOK' | 'ORDER' | 'LEARN_MORE' | 'SIGN_UP' | ''>('');
  const [callToActionUrl, setCallToActionUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState("");

  const activeConfigs = configs.filter(c => c.is_active);

  const handleAddMedia = () => {
    if (newMediaUrl.trim() && mediaUrls.length < 10) {
      setMediaUrls([...mediaUrls, newMediaUrl.trim()]);
      setNewMediaUrl("");
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!summary.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O título é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConfigId) {
      toast({
        title: "Configuração obrigatória",
        description: "Selecione uma conta do Google Meu Negócio.",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Data e horário obrigatórios",
        description: "Selecione a data e horário de publicação.",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);

    createPost({
      google_business_config_id: selectedConfigId,
      post_type: postType,
      summary: summary.trim(),
      description: description.trim() || undefined,
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      call_to_action_type: callToActionType || undefined,
      call_to_action_url: callToActionUrl.trim() || undefined,
      scheduled_for: scheduledFor.toISOString(),
    });
    setShouldReset(true);
  };

  // Resetar formulário quando criação for bem-sucedida
  useEffect(() => {
    if (shouldReset && !isCreating) {
      setPostType('UPDATE');
      setSummary("");
      setDescription("");
      setMediaUrls([]);
      setNewMediaUrl("");
      setCallToActionType('');
      setCallToActionUrl("");
      setScheduledDate("");
      setScheduledTime("");
      setSelectedConfigId("");
      setShouldReset(false);
      onOpenChange(false);
    }
  }, [shouldReset, isCreating, onOpenChange]);

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Postagem no Google Meu Negócio</DialogTitle>
          <DialogDescription>
            Crie e agende uma nova postagem para sua conta do Google Meu Negócio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config">Conta do Google Meu Negócio *</Label>
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {activeConfigs.length === 0 ? (
                  <SelectItem value="no-account" disabled>
                    Nenhuma conta ativa
                  </SelectItem>
                ) : (
                  activeConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.account_name} {config.location_name && `- ${config.location_name}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-type">Tipo de Postagem *</Label>
            <Select value={postType} onValueChange={(v) => setPostType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPDATE">Atualização</SelectItem>
                <SelectItem value="EVENT">Evento</SelectItem>
                <SelectItem value="OFFER">Oferta</SelectItem>
                <SelectItem value="PRODUCT">Produto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Título *</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ex: Nova coleção de verão chegou!"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{summary.length}/100 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva sua postagem..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{description.length}/500 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label>Imagens (máx. 10)</Label>
            <div className="flex gap-2">
              <Input
                value={newMediaUrl}
                onChange={(e) => setNewMediaUrl(e.target.value)}
                placeholder="URL da imagem (deve ser pública)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedia();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddMedia}
                disabled={!newMediaUrl.trim() || mediaUrls.length >= 10}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="space-y-2 mt-2">
                {mediaUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{url}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMedia(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cta-type">Call-to-Action</Label>
              <Select value={callToActionType} onValueChange={(v) => setCallToActionType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="CALL">Ligar</SelectItem>
                  <SelectItem value="BOOK">Reservar</SelectItem>
                  <SelectItem value="ORDER">Pedir</SelectItem>
                  <SelectItem value="LEARN_MORE">Saber Mais</SelectItem>
                  <SelectItem value="SIGN_UP">Inscrever-se</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {callToActionType && (
              <div className="space-y-2">
                <Label htmlFor="cta-url">URL do Call-to-Action</Label>
                <Input
                  id="cta-url"
                  value={callToActionUrl}
                  onChange={(e) => setCallToActionUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Data de Publicação *</Label>
              <Input
                id="scheduled-date"
                type="date"
                min={today}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-time">Horário de Publicação *</Label>
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {scheduledDate && scheduledTime && new Date(`${scheduledDate}T${scheduledTime}:00`) > new Date() ? 'Agendar' : 'Publicar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

