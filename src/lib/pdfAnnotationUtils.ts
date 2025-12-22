import { supabase } from '@/integrations/supabase/client';

export interface SignaturePosition {
  id: string;
  contract_id: string;
  signer_type: 'user' | 'client' | 'rubric';
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
}

/**
 * Busca posições de assinatura definidas no builder para um contrato
 */
export async function getSignaturePositions(contractId: string): Promise<SignaturePosition[]> {
  try {
    const { data, error } = await supabase
      .from('contract_signature_positions')
      .select('*')
      .eq('contract_id', contractId)
      .order('page_number', { ascending: true });

    if (error) {
      console.error('Erro ao buscar posições de assinatura:', error);
      return [];
    }

    return (data || []) as SignaturePosition[];
  } catch (error) {
    console.error('Erro ao buscar posições de assinatura:', error);
    return [];
  }
}

/**
 * Mapeia assinaturas para posições definidas no builder
 */
export function mapSignaturesToPositions(
  signatures: Array<{
    signerType: 'user' | 'client';
    name: string;
    signatureData: string;
    signedAt?: string;
  }>,
  positions: SignaturePosition[]
): Map<number, Array<{ signature: any; position: SignaturePosition }>> {
  const mapped = new Map<number, Array<{ signature: any; position: SignaturePosition }>>();

  for (const position of positions) {
    // Encontrar assinatura correspondente ao tipo
    const signature = signatures.find(s => s.signerType === position.signer_type);
    
    if (signature) {
      if (!mapped.has(position.page_number)) {
        mapped.set(position.page_number, []);
      }
      mapped.get(position.page_number)!.push({ signature, position });
    }
  }

  return mapped;
}

