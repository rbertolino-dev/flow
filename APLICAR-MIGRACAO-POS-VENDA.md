# Aplicar Migration - Funil de Pós-Venda

## Instruções

Para ativar o funil de pós-venda, você precisa aplicar a migration no Supabase.

### Passo 1: Acessar o SQL Editor

1. Acesse o Supabase Dashboard:
   - URL: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

### Passo 2: Aplicar a Migration

1. Abra o arquivo:
   ```
   agilize/supabase/migrations/20250127000000_create_post_sale_leads.sql
   ```

2. Copie TODO o conteúdo do arquivo

3. Cole no SQL Editor do Supabase

4. Clique em **RUN**

### Passo 3: Verificar

Após executar, verifique se as tabelas foram criadas:

1. Vá em **Table Editor** no Supabase
2. Deve aparecer:
   - `post_sale_leads`
   - `post_sale_stages`
   - `post_sale_activities`
   - `post_sale_lead_tags`

### Passo 4: Testar

1. Acesse o sistema
2. No menu lateral, clique em **"Pós-Venda"**
3. Você deve ver o funil de pós-venda com as etapas padrão:
   - Novo Cliente
   - Ativação
   - Suporte
   - Renovação
   - Fidelizado

## Funcionalidades Disponíveis

✅ **Adicionar Clientes Manualmente**
- Botão "Adicionar Cliente" no funil de pós-venda
- Formulário completo com todos os campos

✅ **Transferir do Funil de Vendas**
- Botão "Transferir para Pós-Venda" no modal de detalhes do lead
- Mantém todas as informações do lead original

✅ **Gerenciar Etapas**
- Drag and drop entre etapas
- Etapas personalizáveis por organização

✅ **Visualizar Detalhes**
- Modal com informações completas do cliente
- Histórico de atividades
- Observações

## Próximos Passos

Após aplicar a migration, o funil de pós-venda estará totalmente funcional!

