import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeams, Team } from "@/hooks/useTeams";
import { useEmployees } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Loader2, UserPlus, UserMinus, Eye, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TeamManager() {
  const { teams, loading, fetchTeams, createOrUpdateTeam, addTeamMember, removeTeamMember, fetchTeamMembers, deleteTeam } = useTeams();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    manager_id: "",
  });

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        description: team.description || "",
        manager_id: team.manager_id || "",
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: "",
        description: "",
        manager_id: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleOpenMemberDialog = async (team: Team) => {
    setSelectedTeam(team);
    setLoadingMembers(true);
    const members = await fetchTeamMembers(team.id);
    setTeamMembers(members);
    setLoadingMembers(false);
    setIsMemberDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da equipe é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const result = await createOrUpdateTeam({
      id: editingTeam?.id,
      name: formData.name,
      description: formData.description || undefined,
      manager_id: formData.manager_id || undefined,
    });

    if (result) {
      setIsDialogOpen(false);
      fetchTeams();
    }
  };

  const handleAddMember = async (employeeId: string) => {
    if (!selectedTeam) return;

    const success = await addTeamMember(selectedTeam.id, employeeId);
    if (success) {
      const members = await fetchTeamMembers(selectedTeam.id);
      setTeamMembers(members);
      fetchTeams();
    }
  };

  const handleRemoveMember = async (employeeId: string) => {
    if (!selectedTeam) return;

    const success = await removeTeamMember(selectedTeam.id, employeeId);
    if (success) {
      const members = await fetchTeamMembers(selectedTeam.id);
      setTeamMembers(members);
      fetchTeams();
    }
  };

  const handleView = async (team: Team) => {
    setViewingTeam(team);
    setLoadingMembers(true);
    const members = await fetchTeamMembers(team.id);
    setTeamMembers(members);
    setLoadingMembers(false);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!teamToDelete) return;

    const success = await deleteTeam(teamToDelete.id);
    if (success) {
      setIsDeleteDialogOpen(false);
      setTeamToDelete(null);
      fetchTeams();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Equipes</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Equipe
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma equipe cadastrada
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Gerente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.description || "-"}</TableCell>
                    <TableCell>{team.manager_name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(team)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenMemberDialog(team)}
                          title="Gerenciar membros"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(team)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTeamToDelete(team);
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

      {/* Dialog de equipe */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? "Editar Equipe" : "Nova Equipe"}
            </DialogTitle>
            <DialogDescription>
              {editingTeam
                ? "Atualize as informações da equipe"
                : "Preencha os dados da nova equipe"}
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
                placeholder="Nome da equipe"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da equipe"
              />
            </div>
            <div>
              <Label htmlFor="manager_id">Gerente</Label>
              <Select
                value={formData.manager_id}
                onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um gerente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {employees.filter(e => e.status === 'ativo').map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingTeam ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de membros */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Membros da Equipe: {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Gerencie os membros desta equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Adicionar Funcionário</Label>
              <Select
                onValueChange={(value) => {
                  handleAddMember(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.status === "ativo")
                    .filter((e) => !teamMembers.some((m) => m.employee_id === e.id && m.is_active))
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Data de Entrada</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhum membro na equipe
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamMembers.map((member) => (
                        <TableRow key={`${member.employee_id}-${member.team_id}`}>
                          <TableCell className="font-medium">{member.full_name}</TableCell>
                          <TableCell>{member.cpf}</TableCell>
                          <TableCell>
                            {new Date(member.joined_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            {member.is_active ? "Ativo" : "Inativo"}
                          </TableCell>
                          <TableCell className="text-right">
                            {member.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(member.employee_id)}
                              >
                                <UserMinus className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Equipe</DialogTitle>
            <DialogDescription>
              Informações completas da equipe
            </DialogDescription>
          </DialogHeader>
          {viewingTeam && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="font-medium">{viewingTeam.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gerente</Label>
                  <p>{viewingTeam.manager_name || "-"}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p>{viewingTeam.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Criado em</Label>
                  <p>{new Date(viewingTeam.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Atualizado em</Label>
                  <p>{new Date(viewingTeam.updated_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              
              <div className="mt-6">
                <Label className="text-muted-foreground mb-2 block">Membros da Equipe</Label>
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Data de Entrada</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              Nenhum membro na equipe
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamMembers.map((member) => (
                            <TableRow key={`${member.employee_id}-${member.team_id}`}>
                              <TableCell className="font-medium">{member.full_name}</TableCell>
                              <TableCell>{member.cpf}</TableCell>
                              <TableCell>
                                {new Date(member.joined_at).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                {member.is_active ? "Ativo" : "Inativo"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
            {viewingTeam && (
              <>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleOpenMemberDialog(viewingTeam);
                }}>
                  Gerenciar Membros
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleOpenDialog(viewingTeam);
                }}>
                  Editar
                </Button>
              </>
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
              Tem certeza que deseja excluir a equipe{" "}
              <strong>{teamToDelete?.name}</strong>? Esta ação não pode ser desfeita.
              <span className="block mt-2 text-sm text-muted-foreground">
                Certifique-se de que não há membros ativos na equipe antes de excluir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTeamToDelete(null)}>
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

