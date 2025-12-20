# Registro de Erros - Painel Super Admin

> Documento obrigatório sempre que for alterar qualquer funcionalidade do painel de Super Admin.
> Consulte antes de criar novos recursos ou ajustar flows para evitar regressões recorrentes.

## 1. RPC `get_all_organizations_with_members`
- **Sintoma**: nomes e e-mails dos membros sumiam ou ficavam vazios ao abrir uma organização
- **Causa**: mudanças no Supabase passaram a retornar uma linha por membro (campos `org_*`/`member_*`). O frontend esperava um array JSON agregado e tentava acessar `member.profiles`, resultando em campos vazios
- **Correção aplicada**:
  1. Mapear a nova estrutura (group by `org_id`)
  2. Normalizar `member_roles` mesmo quando vêm como string
  3. Quando ainda faltar e-mail/nome (ex.: cache antigo), buscar via tabelas `profiles` e `user_roles`
- **Checklist antes de qualquer novo deploy**:
  - Rodar `supabase/functions/get_all_organizations_with_members` no console SQL e confirmar campos `member_email`, `member_full_name`, `member_roles`
  - Garantir que qualquer mudança no RPC preserve pelo menos `org_id`, `org_name`, `member_user_id`, `member_email`

## 2. Atualização em tempo real da organização selecionada
- **Sintoma**: depois de criar/excluir usuário o painel só atualizava após refresh manual
- **Causa**: `fetchAllOrganizations()` não retornava a lista e o painel selecionado continuava com os dados antigos
- **Correção aplicada**: sempre que `onUpdate` é chamado (criar usuário, remover membro, etc.) o painel faz `await fetchAllOrganizations()` e substitui o objeto selecionado pela versão recém-carregada
- **Checklist**:
  - Toda ação que altera membros/planos precisa chamar `onUpdate`
  - Sempre retornar a lista atualizada para que o componente pai possa sincronizar `selectedOrg`

## 3. Edge Function `create-user`
- **Sintoma**: erro "Edge Function returned a non-2xx status code" mesmo quando o backend retornava mensagem amigável
- **Causa**: a função devolvia `status 400` em qualquer validação (senha curta, usuário já existente). O Supabase JS tratava como falha de rede e não repassava a mensagem
- **Correção aplicada**:
  1. Responder sempre `status 200` com `{ success: true|false, error?: string }`
  2. Expor cabeçalhos `Access-Control-Allow-Methods: POST, OPTIONS` e retornar `204` nos preflight
  3. No frontend, capturar `error.context.response` para extrair a mensagem real caso o SDK ainda retorne erro
- **Checklist**:
  - Sempre testar via `curl` ou `supabase functions invoke create-user --env-file .env` após alterar a função
  - Garantir que mudanças futuras mantenham o formato `{ success, error }`

## 4. Nomes das empresas não aparecem no Super Admin
- **Sintoma**: Nomes das organizações aparecem vazios ou como "Sem nome" na lista do Super Admin
- **Causa**: A função RPC `get_all_organizations_with_members` pode retornar `org_name` como null ou vazio, ou o mapeamento no frontend não está tratando valores nulos
- **Correção aplicada**:
  1. Adicionar fallback `row.org_name || 'Sem nome'` ao mapear organizações
  2. Validar que `row.org_id` existe antes de processar
  3. Adicionar logs de debug para identificar organizações sem nome
  4. Garantir que `created_at` tenha fallback se vier null
- **Checklist antes de qualquer novo deploy**:
  - Verificar se a função RPC retorna `org_name` corretamente: `SELECT org_id, org_name FROM get_all_organizations_with_members() LIMIT 5;`
  - Verificar se há organizações sem nome na tabela: `SELECT id, name FROM organizations WHERE name IS NULL OR name = '';`
  - Garantir que o mapeamento no frontend sempre tenha fallback para nome
  - Testar visualmente no Super Admin que todos os nomes aparecem

## 5. Erro "column does not exist" ao buscar organizações
- **Sintoma**: Erro `42703: column organizations.plan_id does not exist` ao carregar organizações no Super Admin
- **Causa**: Tentativa de buscar coluna `plan_id` diretamente da tabela `organizations`, mas essa coluna não existe nessa tabela. O `plan_id` está na tabela relacionada `organization_limits`
- **Correção aplicada**:
  1. Remover `plan_id` da query de `organizations`: `.select('id, name, created_at')`
  2. Buscar `plan_id` separadamente da tabela `organization_limits` quando necessário
  3. Combinar dados após buscar de ambas as tabelas
- **Checklist antes de qualquer novo deploy**:
  - ✅ **SEMPRE** verificar migrations antes de fazer queries: `grep -r "CREATE TABLE.*organizations" supabase/migrations/`
  - ✅ **SEMPRE** verificar se coluna existe na tabela antes de usar: `SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations'`
  - ✅ **SEMPRE** buscar dados relacionados de tabelas relacionadas (não assumir que coluna existe)
  - ✅ **SEMPRE** usar fallbacks apropriados para colunas opcionais
  - ✅ **NUNCA** assumir estrutura de tabela sem verificar migrations primeiro
- **Regra criada**: Adicionada regra obrigatória no `.cursorrules` para validação de schema antes de queries no Super Admin

## 6. Logs e diagnóstico mínimo antes de mexer
Sempre seguir esta sequência antes de editar qualquer parte do Super Admin:
1. **Schema**: Verificar estrutura real da tabela nas migrations: `grep -r "CREATE TABLE.*[tabela]" supabase/migrations/`
2. **RPC**: executar `select * from get_all_organizations_with_members();` e validar campos obrigatórios (`org_id`, `org_name`)
3. **Organizações**: `select id, name, created_at from organizations order by created_at desc limit 10;` para verificar se há nomes nulos
4. **Tabelas relacionadas**: Verificar se dados relacionados estão em tabelas corretas (ex: `plan_id` em `organization_limits`, não em `organizations`)
5. **Perfis**: `select id, email from profiles where id in (...);` para confirmar que os perfis associados existem
6. **Roles**: `select user_id, role from user_roles where user_id in (...);`
7. **Funções Edge**: `supabase functions logs --filter create-user`

Se qualquer item falhar, corrigir primeiro no backend antes de alterar o frontend.

## 7. Erro "Could not find the function public.delete_user_from_organization"
- **Sintoma**: Erro `PGRST202: Could not find the function public.delete_user_from_organization(_org_id, _user_id) in the schema cache` ao tentar excluir usuário
- **Causa**: A função `delete_user_from_organization` não existe no banco de dados ou não está no schema cache do Supabase. Pode ter sido removida ou nunca foi aplicada corretamente
- **Correção aplicada**:
  1. Criada migration `20251218002011_fix_delete_user_from_organization.sql` que garante que ambas as funções existam:
     - `transfer_user_data_to_admin`: Transfere todos os dados do usuário para um admin da organização
     - `delete_user_from_organization`: Remove o usuário da organização e, se não pertencer a outras organizações, exclui o perfil e auth
  2. Funções criadas com `CREATE OR REPLACE` para garantir que existam mesmo se já foram criadas antes
  3. Permissões garantidas com `GRANT EXECUTE` para usuários autenticados
- **Checklist antes de qualquer novo deploy**:
  - ✅ **SEMPRE** verificar se funções RPC existem antes de chamá-las: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'delete_user_from_organization';`
  - ✅ **SEMPRE** aplicar migrations que criam funções antes de usar no frontend
  - ✅ **SEMPRE** testar função RPC após criar: `SELECT public.delete_user_from_organization('user_id', 'org_id');`
  - ✅ **SEMPRE** verificar dependências de funções (ex: `delete_user_from_organization` depende de `transfer_user_data_to_admin`)
- **Como aplicar a correção**:
  1. Aplicar migration `supabase/migrations/20251218002011_fix_delete_user_from_organization.sql` via Supabase SQL Editor ou CLI
  2. Verificar que funções foram criadas: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');`
  3. Testar exclusão de usuário no Super Admin

---
Atualizado em: 2025-12-18
Responsável: Cursor AI


