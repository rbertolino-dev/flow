import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as organizações ativas
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true);

    if (orgError) {
      throw new Error(`Erro ao buscar organizações: ${orgError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma organização encontrada', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSuccess = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    // Processar cada organização
    for (const org of organizations) {
      try {
        // Buscar todos os contratos com PDF
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select('id, pdf_url')
          .eq('organization_id', org.id)
          .not('pdf_url', 'is', null);

        if (contractsError) {
          errors.push(`Org ${org.id}: ${contractsError.message}`);
          continue;
        }

        if (!contracts || contracts.length === 0) {
          continue;
        }

        // Buscar configuração de backup storage
        const { data: backupConfig } = await supabase
          .from('contract_storage_config')
          .select('backup_storage_type, backup_config, backup_is_active')
          .is('organization_id', null)
          .eq('backup_is_active', true)
          .maybeSingle();

        // Se backup não estiver configurado ou desativado, pular organização
        if (!backupConfig || !backupConfig.backup_storage_type) {
          continue; // Pular organização se backup não estiver configurado
        }

        const backupStorageType = backupConfig.backup_storage_type;
        const backupStorageConfig = backupConfig.backup_config || {};

        // Processar cada contrato
        for (const contract of contracts) {
          try {
            // Baixar PDF do storage principal (Supabase)
            const response = await fetch(contract.pdf_url);
            if (!response.ok) {
              errors.push(`Contrato ${contract.id}: Erro ao baixar PDF`);
              totalFailed++;
              continue;
            }

            const pdfBlob = await response.blob();
            const fileSize = pdfBlob.size;

            // Calcular checksum
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const checksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

            let backupUrl: string;

            // Fazer upload para storage de backup configurado
            if (backupStorageType === 'supabase') {
              // Backup em Supabase Storage
              const fileName = `${contract.id}-backup-daily-${Date.now()}.pdf`;
              const filePath = `${org.id}/backups/${fileName}`;

              const { error: uploadError } = await supabase.storage
                .from('whatsapp-workflow-media')
                .upload(filePath, pdfBlob, {
                  upsert: false,
                  contentType: 'application/pdf',
                });

              if (uploadError) {
                errors.push(`Contrato ${contract.id}: ${uploadError.message}`);
                totalFailed++;
                continue;
              }

              // Obter URL pública
              const { data: publicUrlData } = supabase.storage
                .from('whatsapp-workflow-media')
                .getPublicUrl(filePath);

              backupUrl = publicUrlData.publicUrl;
            } else if (backupStorageType === 'firebase') {
              // TODO: Implementar upload para Firebase Storage
              errors.push(`Contrato ${contract.id}: Firebase Storage backup ainda não implementado na edge function`);
              totalFailed++;
              continue;
            } else if (backupStorageType === 's3') {
              // TODO: Implementar upload para S3
              errors.push(`Contrato ${contract.id}: S3 backup ainda não implementado na edge function`);
              totalFailed++;
              continue;
            } else {
              errors.push(`Contrato ${contract.id}: Tipo de backup storage não suportado: ${backupStorageType}`);
              totalFailed++;
              continue;
            }

            // Salvar registro do backup
            const { error: backupError } = await supabase
              .from('contract_backups')
              .insert({
                contract_id: contract.id,
                storage_type: backupStorageType,
                backup_url: backupUrl,
                backup_type: 'daily',
                file_size: fileSize,
                checksum,
              });

            if (backupError) {
              errors.push(`Contrato ${contract.id}: ${backupError.message}`);
              totalFailed++;
            } else {
              totalSuccess++;
            }
          } catch (error: any) {
            errors.push(`Contrato ${contract.id}: ${error.message}`);
            totalFailed++;
          }
        }
      } catch (error: any) {
        errors.push(`Org ${org.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: organizations.length,
        backupsCreated: totalSuccess,
        backupsFailed: totalFailed,
        errors: errors.slice(0, 10), // Limitar a 10 erros
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no backup diário:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

