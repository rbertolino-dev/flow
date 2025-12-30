# 🔧 Fix Onboarding - Resumo e Instruções

## ✅ Correções Implementadas

### 1. Erro `price.toFixed is not a function`
- **Arquivo corrigido:** `src/components/onboarding/ProductsStep.tsx`
- **Solução:** Validação para garantir que `price` seja sempre número
- **Migration:** Garante que `products.price` seja `NUMERIC(10, 2)`

### 2. Erro de Foreign Key com `profiles`
- **Arquivo corrigido:** `src/hooks/useOnboarding.ts`
- **Solução:** 
  - Foreign key alterada de `profiles(id)` para `auth.users(id)`
  - Função `ensure_user_profile()` criada para garantir profile existe
- **Migration:** Ajusta constraint e cria função helper

### 3. Erro ao criar QR Code Evolution
- **Arquivo corrigido:** `supabase/functions/create-evolution-instance/index.ts`
- **Solução:** Endpoint corrigido de `/instance/qrcode/` para `/instance/connect/`

### 4. Erro 406 com `facebook_configs`
- **Migration:** Políticas RLS recriadas com suporte a:
  - Membros da organização
  - Super admins
  - Usuários PubDigital

## 📋 Como Aplicar

### Opção 1: Script Automatizado (Recomendado)
```bash
cd /root/kanban-buzz-95241
./scripts/aplicar-fix-automatico-completo.sh
```

### Opção 2: Aplicar Migration Manualmente

1. **Acesse o Supabase SQL Editor:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Cole o SQL da migration:**
   - Arquivo: `supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql`
   - Ou execute o script que mostra o SQL completo

3. **Execute o SQL:**
   - Clique em "Run" ou pressione Ctrl+Enter

### Opção 3: Via Edge Function (Futuro)
```javascript
// No console do navegador (após login como admin)
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch('https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/apply-onboarding-fix', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
});
const result = await response.json();
console.log(result);
```

## 🚀 Status do Deploy

O código já foi commitado e enviado para o GitHub. O deploy zero-downtime está configurado para executar automaticamente.

Para verificar status:
```bash
# Verificar se deploy está em andamento
ls -la /tmp/deploy-zero-downtime.lock

# Verificar containers
docker compose -f docker-compose.blue.yml ps
# ou
docker compose -f docker-compose.green.yml ps
```

## ✅ Checklist de Verificação

Após aplicar a migration e o deploy:

- [ ] Migration aplicada no Supabase SQL Editor
- [ ] Deploy concluído (verificar containers)
- [ ] Testar cadastro em: https://agilizeflow.com.br/CADASTRO
- [ ] Verificar se não há erro `price.toFixed`
- [ ] Verificar se onboarding completa sem erro de foreign key
- [ ] Verificar se QR Code Evolution funciona
- [ ] Verificar se `facebook_configs` não retorna 406
- [ ] Verificar se menu aparece corretamente após onboarding

## 📝 Arquivos Modificados

1. `src/components/onboarding/ProductsStep.tsx` - Fix price.toFixed
2. `src/hooks/useOnboarding.ts` - Fix foreign key e ensure profile
3. `supabase/functions/create-evolution-instance/index.ts` - Fix QR code endpoint
4. `supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql` - Migration completa

## 🔍 Troubleshooting

### Se migration falhar:
- Verifique se você tem permissões de administrador no Supabase
- Execute cada bloco `DO $$ ... END $$;` separadamente
- Verifique logs no Supabase Dashboard > Logs

### Se deploy falhar:
- Verifique logs: `tail -f /var/log/kanban-buzz-deploy.log`
- Execute manualmente: `./scripts/deploy-zero-downtime.sh --confirm`
- Verifique se Git está sincronizado: `git pull origin main`

### Se ainda houver erros:
- Verifique console do navegador (F12)
- Verifique logs do Supabase: Dashboard > Logs > Edge Functions
- Verifique RLS policies: Dashboard > Authentication > Policies

## 📞 Suporte

Para mais informações, consulte:
- Scripts em: `scripts/aplicar-fix-*.sh`
- Migration em: `supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql`
- Edge function: `supabase/functions/apply-onboarding-fix/index.ts`

