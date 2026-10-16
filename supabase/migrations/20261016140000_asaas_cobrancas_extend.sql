-- Extensão do módulo Cobranças (Boletos Asaas)
-- Origem orçamento/venda, parcelas, multa/juros, snapshot do cliente e flag financeiro

ALTER TABLE public.whatsapp_boletos
  ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_sale_id UUID,
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multa_valor NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros_percentual NUMERIC(8, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS postal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS generate_financial BOOLEAN DEFAULT true;

-- FK opcional para pos_sales (pode não existir em todos os ambientes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pos_sales'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'whatsapp_boletos_pos_sale_id_fkey'
        AND table_name = 'whatsapp_boletos'
    ) THEN
      ALTER TABLE public.whatsapp_boletos
        ADD CONSTRAINT whatsapp_boletos_pos_sale_id_fkey
        FOREIGN KEY (pos_sale_id) REFERENCES public.pos_sales(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_installment_group
  ON public.whatsapp_boletos (organization_id, installment_group_id)
  WHERE installment_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_budget_id
  ON public.whatsapp_boletos (budget_id)
  WHERE budget_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_pos_sale_id
  ON public.whatsapp_boletos (pos_sale_id)
  WHERE pos_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_customer_name
  ON public.whatsapp_boletos (organization_id, customer_name);

COMMENT ON COLUMN public.whatsapp_boletos.installment_group_id IS 'Agrupa boletos da mesma cobrança parcelada';
COMMENT ON COLUMN public.whatsapp_boletos.postal_enabled IS 'Notificações email/SMS via Asaas';
COMMENT ON COLUMN public.whatsapp_boletos.generate_financial IS 'Se true, cria conta a receber no financeiro';
