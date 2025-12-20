import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePositions, Position } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { PositionsSkeleton } from "./EmployeesSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PositionManager() {
  const { positions, loading, fetchPositions, createOrUpdatePosition, deletePosition } = usePositions();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [viewingPosition, setViewingPosition] = useState<Position | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    base_salary: "",
    is_active: true,
    hierarchical_level: "",
    department: "",
    requirements: "",
    salary_min: "",
    salary_max: "",
  });

  const handleOpenDialog = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setFormData({
        name: position.name,
        description: position.description || "",
        base_salary: position.base_salary.toString(),
        is_active: position.is_active,
        hierarchical_level: position.hierarchical_level || "",
        department: position.department || "",
        requirements: position.requirements || "",
        salary_min: position.salary_min?.toString() || "",
        salary_max: position.salary_max?.toString() || "",
      });
    } else {
      setEditingPosition(null);
      setFormData({
        name: "",
        description: "",
        base_salary: "",
        is_active: true,
        hierarchical_level: "",
        department: "",
        requirements: "",
        salary_min: "",
        salary_max: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do cargo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const salary = parseFloat(formData.base_salary);
    if (isNaN(salary) || salary < 0) {
      toast({
        title: "Erro",
        description: "Salário base deve ser um número válido maior ou igual a zero",
        variant: "destructive",
      });
      return;
    }

    const salaryMin = formData.salary_min ? parseFloat(formData.salary_min) : undefined;
    const salaryMax = formData.salary_max ? parseFloat(formData.salary_max) : undefined;

    const result = await createOrUpdatePosition({
      id: editingPosition?.id,
      name: formData.name,
      description: formData.description || undefined,
      base_salary: salary,
      is_active: formData.is_active,
      hierarchical_level: formData.hierarchical_level || undefined,
      department: formData.department || undefined,
      requirements: formData.requirements || undefined,
      salary_min: salaryMin,
      salary_max: salaryMax,
    });

    if (result) {
      setIsDialogOpen(false);
      fetchPositions(false);
    }
  };

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }, []);

  const handleView = (position: Position) => {
    setViewingPosition(position);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!positionToDelete) return;

    const success = await deletePosition(positionToDelete.id);
    if (success) {
      setIsDeleteDialogOpen(false);
      setPositionToDelete(null);
      fetchPositions(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cargos</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cargo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <PositionsSkeleton />
        ) : positions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cargo cadastrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Salário Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>{position.description || "-"}</TableCell>
                    <TableCell>{formatCurrency(position.base_salary)}</TableCell>
                    <TableCell>
                      <Badge variant={position.is_active ? "default" : "secondary"}>
                        {position.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(position)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(position)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPositionToDelete(position);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? "Editar Cargo" : "Novo Cargo"}
            </DialogTitle>
            <DialogDescription>
              {editingPosition
                ? "Atualize as informações do cargo"
                : "Preencha os dados do novo cargo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do cargo"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do cargo"
              />
            </div>
            <div>
              <Label htmlFor="base_salary">Salário Base</Label>
              <Input
                id="base_salary"
                type="number"
                step="0.01"
                min="0"
                value={formData.base_salary}
                onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="hierarchical_level">Nível Hierárquico</Label>
              <Select
                value={formData.hierarchical_level}
                onValueChange={(value) => setFormData({ ...formData, hierarchical_level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="pleno">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="diretor">Diretor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="department">Departamento/Setor</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Ex: TI, Vendas, RH"
              />
            </div>
            <div>
              <Label htmlFor="requirements">Requisitos/Qualificações</Label>
              <Input
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="Descreva os requisitos necessários"
              />
            </div>
            <div>
              <Label htmlFor="salary_min">Faixa Salarial Mínima</Label>
              <Input
                id="salary_min"
                type="number"
                step="0.01"
                min="0"
                value={formData.salary_min}
                onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="salary_max">Faixa Salarial Máxima</Label>
              <Input
                id="salary_max"
                type="number"
                step="0.01"
                min="0"
                value={formData.salary_max}
                onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingPosition ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cargo</DialogTitle>
            <DialogDescription>
              Informações completas do cargo
            </DialogDescription>
          </DialogHeader>
          {viewingPosition && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="font-medium">{viewingPosition.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>
                    <Badge variant={viewingPosition.is_active ? "default" : "secondary"}>
                      {viewingPosition.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p>{viewingPosition.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Salário Base</Label>
                  <p className="font-medium">{formatCurrency(viewingPosition.base_salary)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nível Hierárquico</Label>
                  <p>{viewingPosition.hierarchical_level || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Departamento</Label>
                  <p>{viewingPosition.department || "-"}</p>
                </div>
                {viewingPosition.salary_min && (
                  <div>
                    <Label className="text-muted-foreground">Faixa Salarial Mínima</Label>
                    <p>{formatCurrency(viewingPosition.salary_min)}</p>
                  </div>
                )}
                {viewingPosition.salary_max && (
                  <div>
                    <Label className="text-muted-foreground">Faixa Salarial Máxima</Label>
                    <p>{formatCurrency(viewingPosition.salary_max)}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Requisitos/Qualificações</Label>
                  <p>{viewingPosition.requirements || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Criado em</Label>
                  <p>{new Date(viewingPosition.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Atualizado em</Label>
                  <p>{new Date(viewingPosition.updated_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
            {viewingPosition && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                handleOpenDialog(viewingPosition);
              }}>
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo{" "}
              <strong>{positionToDelete?.name}</strong>? Esta ação não pode ser desfeita.
              {positionToDelete && !positionToDelete.is_active && (
                <span className="block mt-2 text-sm text-muted-foreground">
                  O cargo já está inativo.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPositionToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

