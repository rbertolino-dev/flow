import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployees, Employee } from "@/hooks/useEmployees";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSuccess?: () => void;
}

// Função para validar CPF
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

// Função para formatar CPF
function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return value;
}

// Função para formatar telefone
function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 11) {
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
  }
  return value;
}

// Função para validar email
function validateEmail(email: string): boolean {
  if (!email) return true; // Email é opcional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function EmployeeForm({ open, onOpenChange, employee, onSuccess }: EmployeeFormProps) {
  const { createEmployee, updateEmployee } = useEmployees();
  const { positions } = usePositions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    rg: "",
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    admission_date: "",
    dismissal_date: "",
    status: "ativo",
    current_position_id: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    account_type: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    ctps: "",
    pis: "",
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || "",
        cpf: employee.cpf || "",
        rg: employee.rg || "",
        birth_date: employee.birth_date ? employee.birth_date.split('T')[0] : "",
        phone: employee.phone || "",
        email: employee.email || "",
        address: employee.address || "",
        city: employee.city || "",
        state: employee.state || "",
        zip_code: employee.zip_code || "",
        admission_date: employee.admission_date ? employee.admission_date.split('T')[0] : "",
        dismissal_date: employee.dismissal_date ? employee.dismissal_date.split('T')[0] : "",
        status: employee.status || "ativo",
        current_position_id: employee.current_position_id || "",
        bank_name: employee.bank_name || "",
        bank_agency: employee.bank_agency || "",
        bank_account: employee.bank_account || "",
        account_type: employee.account_type || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
        ctps: employee.ctps || "",
        pis: employee.pis || "",
      });
    } else {
      setFormData({
        full_name: "",
        cpf: "",
        rg: "",
        birth_date: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        admission_date: "",
        dismissal_date: "",
        status: "ativo",
        current_position_id: "",
        bank_name: "",
        bank_agency: "",
        bank_account: "",
        account_type: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        ctps: "",
        pis: "",
      });
    }
    setErrors({});
  }, [employee, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "Nome é obrigatório";
    }

    if (!formData.cpf.trim()) {
      newErrors.cpf = "CPF é obrigatório";
    } else {
      const cleanedCPF = formData.cpf.replace(/\D/g, "");
      if (cleanedCPF.length !== 11) {
        newErrors.cpf = "CPF deve ter 11 dígitos";
      } else if (!validateCPF(cleanedCPF)) {
        newErrors.cpf = "CPF inválido";
      }
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.admission_date) {
      newErrors.admission_date = "Data de admissão é obrigatória";
    } else {
      const admissionDate = new Date(formData.admission_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (admissionDate > today) {
        newErrors.admission_date = "Data de admissão não pode ser futura";
      }
    }

    if (formData.dismissal_date && formData.admission_date) {
      const dismissalDate = new Date(formData.dismissal_date);
      const admissionDate = new Date(formData.admission_date);
      if (dismissalDate < admissionDate) {
        newErrors.dismissal_date = "Data de demissão deve ser posterior à data de admissão";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast({
        title: "Erro de validação",
        description: "Por favor, corrija os erros no formulário",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const cleanedCPF = formData.cpf.replace(/\D/g, "");
      const cleanedPhone = formData.phone.replace(/\D/g, "");

      const cleanedEmergencyPhone = formData.emergency_contact_phone.replace(/\D/g, "");

      const employeeData = {
        ...formData,
        cpf: cleanedCPF,
        phone: cleanedPhone || undefined,
        email: formData.email || undefined,
        current_position_id: formData.current_position_id || undefined,
        birth_date: formData.birth_date || undefined,
        dismissal_date: formData.dismissal_date || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: cleanedEmergencyPhone || undefined,
        ctps: formData.ctps || undefined,
        pis: formData.pis || undefined,
      };

      if (employee) {
        await updateEmployee(employee.id, employeeData);
      } else {
        await createEmployee(employeeData);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar funcionário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar funcionário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? "Editar Funcionário" : "Novo Funcionário"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do funcionário. Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Dados Pessoais */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold mb-3">Dados Pessoais</h3>
            </div>
            <div>
              <Label htmlFor="full_name">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome completo"
                className={errors.full_name ? "border-destructive" : ""}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive mt-1">{errors.full_name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cpf">
                CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  setFormData({ ...formData, cpf: formatted });
                }}
                placeholder="000.000.000-00"
                maxLength={14}
                className={errors.cpf ? "border-destructive" : ""}
              />
              {errors.cpf && (
                <p className="text-sm text-destructive mt-1">{errors.cpf}</p>
              )}
            </div>
            <div>
              <Label htmlFor="rg">RG</Label>
              <Input
                id="rg"
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                placeholder="RG"
              />
            </div>
            <div>
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setFormData({ ...formData, phone: formatted });
                }}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            {/* Endereço */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">Endereço</h3>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="zip_code">CEP</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                placeholder="00000-000"
              />
            </div>

            {/* Dados Profissionais */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">Dados Profissionais</h3>
            </div>
            <div>
              <Label htmlFor="admission_date">
                Data de Admissão <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admission_date"
                type="date"
                value={formData.admission_date}
                onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                className={errors.admission_date ? "border-destructive" : ""}
              />
              {errors.admission_date && (
                <p className="text-sm text-destructive mt-1">{errors.admission_date}</p>
              )}
            </div>
            <div>
              <Label htmlFor="dismissal_date">Data de Demissão</Label>
              <Input
                id="dismissal_date"
                type="date"
                value={formData.dismissal_date}
                onChange={(e) => setFormData({ ...formData, dismissal_date: e.target.value })}
                className={errors.dismissal_date ? "border-destructive" : ""}
              />
              {errors.dismissal_date && (
                <p className="text-sm text-destructive mt-1">{errors.dismissal_date}</p>
              )}
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="current_position_id">Cargo</Label>
              <Select
                value={formData.current_position_id}
                onValueChange={(value) => setFormData({ ...formData, current_position_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {positions.filter(p => p.is_active).map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dados Bancários */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">Dados Bancários</h3>
            </div>
            <div>
              <Label htmlFor="bank_name">Banco</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="Nome do banco"
              />
            </div>
            <div>
              <Label htmlFor="bank_agency">Agência</Label>
              <Input
                id="bank_agency"
                value={formData.bank_agency}
                onChange={(e) => setFormData({ ...formData, bank_agency: e.target.value })}
                placeholder="Agência"
              />
            </div>
            <div>
              <Label htmlFor="bank_account">Conta</Label>
              <Input
                id="bank_account"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                placeholder="Número da conta"
              />
            </div>
            <div>
              <Label htmlFor="account_type">Tipo de Conta</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dados de Emergência e Documentos */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">Contato de Emergência</h3>
            </div>
            <div>
              <Label htmlFor="emergency_contact_name">Nome do Contato</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="emergency_contact_phone">Telefone do Contato</Label>
              <Input
                id="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setFormData({ ...formData, emergency_contact_phone: formatted });
                }}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">Documentos Adicionais</h3>
            </div>
            <div>
              <Label htmlFor="ctps">CTPS (Carteira de Trabalho)</Label>
              <Input
                id="ctps"
                value={formData.ctps}
                onChange={(e) => setFormData({ ...formData, ctps: e.target.value })}
                placeholder="Número da CTPS"
              />
            </div>
            <div>
              <Label htmlFor="pis">PIS</Label>
              <Input
                id="pis"
                value={formData.pis}
                onChange={(e) => setFormData({ ...formData, pis: e.target.value })}
                placeholder="Número do PIS"
              />
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {employee ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

