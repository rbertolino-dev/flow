import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedOrgId?: string;
}

interface Organization {
  id: string;
  name: string;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess, preselectedOrgId }: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(preselectedOrgId || "");
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canSubmit = !!email.trim() && password.trim().length >= 6 && !!selectedOrgId && !loading;

  useEffect(() => {
    if (open) {
      fetchOrganizations();
      if (preselectedOrgId) {
        setSelectedOrgId(preselectedOrgId);
      }
    }
  }, [open, preselectedOrgId]);

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Erro ao carregar organizações:", error);
    } else {
      setOrganizations(data || []);
      // Auto-seleciona a org passada por props ou a primeira disponível
      const defaultOrgId = preselectedOrgId || (data && data.length > 0 ? data[0].id : "");
      if (!selectedOrgId && defaultOrgId) {
        setSelectedOrgId(defaultOrgId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim();
    const passwordTrim = password.trim();

    if (!emailTrim || !passwordTrim || !selectedOrgId) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validações básicas
    const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
    if (!emailRegex.test(emailTrim)) {
      toast({ title: "Email inválido", description: "Informe um email válido.", variant: "destructive" });
      return;
    }
    if (passwordTrim.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Criar usuário via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: email.trim(),
          password: password.trim(),
          fullName: fullName.trim() || email.trim(),
          isAdmin,
          organizationId: selectedOrgId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar usuário');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Não precisa mais adicionar manualmente, a edge function já faz isso
      toast({
        title: "Sucesso!",
        description: "Usuário criado e adicionado à organização",
      });

      // Reset form
      setEmail("");
      setPassword("");
      setFullName("");
      setSelectedOrgId(preselectedOrgId || "");
      setIsAdmin(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um novo usuário ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email*</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha*</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                placeholder="João Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organização*</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma organização" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAdmin"
                checked={isAdmin}
                onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                disabled={loading}
              />
              <Label htmlFor="isAdmin" className="cursor-pointer">
                Tornar administrador
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
