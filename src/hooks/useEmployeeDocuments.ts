import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Document {
  id: string;
  employee_id: string;
  document_type: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  file_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useEmployeeDocuments(employeeId?: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = useCallback(async (empId?: string) => {
    const id = empId || employeeId;
    if (!id) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-documents?employee_id=${id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar documentos");
      }

      const result = await response.json();
      setDocuments(result.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar documentos:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

  const createDocument = useCallback(async (
    documentData: Omit<Document, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Document | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(documentData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar documento");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Documento criado com sucesso",
      });
      await fetchDocuments(documentData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao criar documento:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar documento",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchDocuments]);

  const updateDocument = useCallback(async (
    id: string,
    documentData: Partial<Document>
  ): Promise<Document | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-documents`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, ...documentData }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar documento");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Documento atualizado com sucesso",
      });
      await fetchDocuments(documentData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao atualizar documento:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar documento",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchDocuments]);

  const deleteDocument = useCallback(async (
    id: string,
    empId: string
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-documents?id=${id}&employee_id=${empId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao deletar documento");
      }

      toast({
        title: "Sucesso",
        description: "Documento deletado com sucesso",
      });
      await fetchDocuments(empId);
      return true;
    } catch (error: any) {
      console.error("Erro ao deletar documento:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar documento",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchDocuments]);

  return {
    documents,
    loading,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}


