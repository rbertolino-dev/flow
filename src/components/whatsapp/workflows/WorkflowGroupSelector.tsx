import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowGroups } from "@/hooks/useWorkflowGroups";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { WorkflowGroup } from "@/types/workflows";
import { Search, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkflowGroupSelectorProps {
  instanceId?: string;
  instances: EvolutionConfig[];
  selectedGroupId?: string;
  onGroupSelect: (groupId: string) => void;
}

interface EvolutionGroup {
  id: string;
  subject: string;
  creation?: number;
  owner?: string;
  participants?: Array<{
    id: string;
    isAdmin?: boolean;
  }>;
}

export function WorkflowGroupSelector({
  instanceId,
  instances,
  selectedGroupId,
  onGroupSelect,
}: WorkflowGroupSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [availableGroups, setAvailableGroups] = useState<EvolutionGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionConfig | null>(
    instances.find((i) => i.id === instanceId) || instances[0] || null
  );
  const { toast } = useToast();
  const { registeredGroups, createOrGetGroup, fetchGroupsFromEvolution } =
    useWorkflowGroups(instanceId);

  // Buscar grupos da Evolution API quando instância for selecionada
  useEffect(() => {
    if (selectedInstance && selectedInstance.is_connected) {
      loadGroupsFromEvolution(selectedInstance);
    } else {
      setAvailableGroups([]);
    }
  }, [selectedInstance]);

  const loadGroupsFromEvolution = async (instance: EvolutionConfig) => {
    setIsLoadingGroups(true);
    try {
      const groups = await fetchGroupsFromEvolution(instance);
      setAvailableGroups(groups);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar grupos",
        description: error.message,
        variant: "destructive",
      });
      setAvailableGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleGroupSelect = async (evolutionGroup: EvolutionGroup) => {
    if (!selectedInstance) {
      toast({
        title: "Selecione uma instância",
        description: "É necessário selecionar uma instância antes de escolher um grupo.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Registrar grupo apenas quando selecionado (registro inteligente)
      const registeredGroup = await createOrGetGroup({
        groupId: evolutionGroup.id,
        groupName: evolutionGroup.subject || `Grupo ${evolutionGroup.id}`,
        instanceId: selectedInstance.id,
        participantCount: evolutionGroup.participants?.length || null,
      });

      onGroupSelect(registeredGroup.id);
    } catch (error: any) {
      toast({
        title: "Erro ao selecionar grupo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Normalização para busca (remove acentos e padroniza)
  const normalize = (s?: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const search = normalize(searchTerm);
  const searchDigits = searchTerm.replace(/\D/g, "");

  const filteredGroups = availableGroups.filter((group) => {
    const subject = normalize(group.subject);
    const id = (group.id || "").toLowerCase();

    const bySubjectOrId = subject.includes(search) || id.includes(search);

    const byParticipant = !!searchDigits &&
      (group.participants || []).some((p) => {
        const participantDigits = (p.id || "").replace(/\D/g, "");
        return participantDigits.includes(searchDigits);
      });

    return search ? (bySubjectOrId || byParticipant) : true;
  });

  const selectedRegisteredGroup = registeredGroups.find((g) => g.id === selectedGroupId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Selecionar Grupo de WhatsApp</CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha uma instância e selecione um grupo. O grupo será registrado automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="instance-select">Instância</Label>
          <Select
            value={selectedInstance?.id || ""}
            onValueChange={(value) => {
              const instance = instances.find((i) => i.id === value);
              setSelectedInstance(instance || null);
            }}
          >
            <SelectTrigger id="instance-select">
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              {instances
                .filter((i) => i.is_connected)
                .map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name} {instance.phone_number && `(${instance.phone_number})`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {selectedInstance && selectedInstance.is_connected && (
          <>
            <div>
              <Label htmlFor="group-search">Buscar Grupo</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="group-search"
                  placeholder="Digite para buscar grupos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {isLoadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Carregando grupos...
                </span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm
                  ? "Nenhum grupo encontrado com esse termo."
                  : "Nenhum grupo disponível nesta instância."}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredGroups.map((group) => (
                  <Button
                    key={group.id}
                    variant={
                      selectedRegisteredGroup?.group_id === group.id ? "default" : "outline"
                    }
                    className="w-full justify-start"
                    onClick={() => handleGroupSelect(group)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">
                        {group.subject || `Grupo ${group.id.slice(0, 8)}...`}
                      </div>
                      {group.participants && (
                        <div className="text-xs text-muted-foreground">
                          {group.participants.length} participante
                          {group.participants.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedRegisteredGroup && (
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">Grupo selecionado:</div>
                <div className="text-sm text-muted-foreground">
                  {selectedRegisteredGroup.group_name}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

