-- Remapeia classificações DRE antigas para as linhas do relatório.

UPDATE public.financial_categories
SET dre_class = CASE dre_class
  WHEN 'receita_vendas' THEN 'receita_bruta_vendas'
  WHEN 'receita_servicos' THEN 'receita_bruta_vendas'
  WHEN 'custo' THEN 'custo_mercadoria'
  WHEN 'despesa_operacional' THEN 'despesas_gerais'
  WHEN 'despesa_financeira' THEN 'despesas_financeiras'
  ELSE dre_class
END
WHERE dre_class IN (
  'receita_vendas',
  'receita_servicos',
  'custo',
  'despesa_operacional',
  'despesa_financeira'
);
