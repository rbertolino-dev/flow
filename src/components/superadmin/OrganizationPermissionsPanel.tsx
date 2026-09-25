import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FeaturePermissionGrid } from "@/components/users/FeaturePermissionGrid";
import { Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  user_roles: Array<{
    role: string;
  }>;
}

interface OrganizationPermissionsPanelProps {
  organizationId: string;
  organizationName: string;
  members: Member[];
  onUpdate?: () => void;
}

export function OrganizationPermissionsPanel({
  organizationId,
  organizationName,
  members,
  onUpdate,
}: OrganizationPermissionsPanelProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const selectedMember = members.find((member) => member.user_id === selectedUser);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gerenciar Permissões por Usuário</CardTitle>
          </div>
          <CardDescription>
            Defina ler, editar e excluir nos módulos que o super admin já liberou para {organizationName}.
            Esta tela não liga nem desliga módulos da organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Selecione um usuário</Label>
            <Select value={selectedUser || ""} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário para gerenciar permissões" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{member.profiles.full_name || member.profiles.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && selectedMember && (
            <>
              <Separator />
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedMember.profiles.full_name || selectedMember.profiles.email}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedMember.profiles.email}</p>
                  </div>
                  <Badge variant={selectedMember.role === "owner" ? "default" : "secondary"}>
                    {selectedMember.role}
                  </Badge>
                </div>
              </div>
              <ScrollArea className="h-[500px] pr-4">
                <FeaturePermissionGrid
                  key={selectedUser}
                  organizationId={organizationId}
                  userId={selectedUser}
                  onSaved={onUpdate}
                />
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
