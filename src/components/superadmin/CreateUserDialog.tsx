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
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canSubmit = !!email.trim() && password.trim().length >= 6 && !!selectedOrgId && !loading;

  useEffect(() => {
    if (open) {
      void fetchOrganizations();
      if (preselectedOrgId) {
        setSelectedOrgId(preselectedOrgId);
      }
    }
    // fetchOrganizations só precisa rodar ao abrir o diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          isAdmin: isCompanyAdmin,
          makeSystemAdmin: isSystemAdmin,
          organizationId: selectedOrgId,
        },
      });

      if (error) {
        let detailedMessage = error.message || 'Erro ao criar usuário';
        const contextResponse = (
          error as { context?: { response?: { text?: () => Promise<string> } } }
        )?.context?.response;
        if (contextResponse && typeof contextResponse.text === 'function') {
          try {
            const rawText = await contextResponse.text();
            if (rawText) {
              try {
                const parsed = JSON.parse(rawText);
                detailedMessage = parsed.error || parsed.message || detailedMessage;
              } catch {
                detailedMessage = rawText;
              }
            }
          } catch {
            // ignora parsing do contexto
          }
        }
        throw new Error(detailedMessage);
      }

      if (data?.error || data?.success === false) {
        throw new Error(data.error || 'Erro ao criar usuário');
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
      setIsCompanyAdmin(false);
      setIsSystemAdmin(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error instanceof Error ? error.message : "Erro desconhecido",
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

            <div className="grid gap-2 sm:grid-cols-2">
              <label
                htmlFor="isCompanyAdmin"
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                  isCompanyAdmin ? "border-green-500 bg-green-50" : "bg-background"
                }`}
              >
                <Checkbox
                  id="isCompanyAdmin"
                  checked={isCompanyAdmin}
                  onCheckedChange={(checked) => setIsCompanyAdmin(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Adm. da empresa</p>
                  <p className={`text-xs mt-0.5 ${isCompanyAdmin ? "text-green-700" : "text-muted-foreground"}`}>
                    {isCompanyAdmin ? "Ativo" : "Desligado"} · só nesta empresa
                  </p>
                </div>
              </label>
              <label
                htmlFor="isSystemAdmin"
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                  isSystemAdmin ? "border-red-500 bg-red-50" : "bg-background"
                }`}
              >
                <Checkbox
                  id="isSystemAdmin"
                  checked={isSystemAdmin}
                  onCheckedChange={(checked) => setIsSystemAdmin(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-destructive">Super Admin</p>
                  <p className={`text-xs mt-0.5 ${isSystemAdmin ? "text-red-700" : "text-muted-foreground"}`}>
                    {isSystemAdmin ? "Ativo" : "Desligado"} · plataforma inteira
                  </p>
                </div>
              </label>
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
