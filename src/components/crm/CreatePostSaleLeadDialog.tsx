import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CreatePostSaleLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreatePostSaleLeadDialog({ open, onOpenChange, onCreated }: CreatePostSaleLeadDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const { createLead } = usePostSaleLeads();
  const { stages, loading: stagesLoading } = usePostSaleStages();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      return;
    }

    // Validar valor não negativo
    if (value && parseFloat(value) < 0) {
      return;
    }

    setLoading(true);
    
    try {
      const success = await createLead({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        value: value && parseFloat(value) >= 0 ? parseFloat(value) : undefined,
        notes: notes.trim() || undefined,
        stageId: stageId || undefined,
      });

      if (success) {
        // Reset form
        setName("");
        setPhone("");
        setEmail("");
        setCompany("");
        setValue("");
        setNotes("");
        setStageId("");
        
        onCreated?.();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Cliente ao Pós-Venda</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                // Permitir apenas valores positivos ou vazio
                if (val === "" || parseFloat(val) >= 0) {
                  setValue(val);
                }
              }}
              placeholder="0.00"
            />
            {value && parseFloat(value) < 0 && (
              <p className="text-xs text-destructive">O valor não pode ser negativo</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Etapa</Label>
            <Select value={stageId} onValueChange={setStageId} disabled={stagesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={stagesLoading ? "Carregando..." : "Selecione uma etapa"} />
              </SelectTrigger>
              <SelectContent>
                {sortedStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o cliente..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !phone.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

