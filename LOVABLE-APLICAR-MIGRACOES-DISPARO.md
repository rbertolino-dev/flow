# 🚀 Instruções para Lovable: Aplicar Migrações de Disparo em Massa

## 📋 Migrações que Precisam ser Aplicadas

Quando o projeto for deployado no Lovable Cloud, as seguintes migrações **DEVEM** ser aplicadas automaticamente:

### 1. **Tabela de Janelas de Horário** (`broadcast_time_windows`)
- **Arquivo:** `supabase/migrations/20251121000000_create_broadcast_time_windows.sql`
- **Função:** Permite configurar horários permitidos para disparos por organização

### 2. **Tabela de Grupos de Instâncias** (`instance_groups`)
- **Arquivo:** `supabase/migrations/20251121000001_create_instance_groups.sql`
- **Função:** Permite agrupar instâncias WhatsApp para disparos em massa

---

## ✅ Como Aplicar (Ordem de Execução)

### **OPÇÃO 1: Aplicação Automática pelo Lovable (Recomendado)**

O Lovable deve detectar e aplicar automaticamente as migrações na pasta `supabase/migrations/` quando:

1. **Commit e Push são feitos:**
   ```bash
   git add supabase/migrations/20251121000000_create_broadcast_time_windows.sql
   git add supabase/migrations/20251121000001_create_instance_groups.sql
   git commit -m "Add broadcast time windows and instance groups migrations"
   git push
   ```

2. **O Lovable detecta:**
   - Novos arquivos `.sql` na pasta `supabase/migrations/`
   - Aplica na ordem numérica (timestamp)
   - Executa automaticamente no deploy

---

### **OPÇÃO 2: Aplicação Manual via SQL Editor**

Se a aplicação automática não funcionar, execute manualmente:

#### **Passo 1: Aplicar Migração de Janelas de Horário**

1. Acesse o **Supabase Dashboard** do projeto
2. Vá em **SQL Editor**
3. Execute o conteúdo completo de:
   ```
   supabase/migrations/20251121000000_create_broadcast_time_windows.sql
   ```

#### **Passo 2: Aplicar Migração de Grupos de Instâncias**

1. No mesmo **SQL Editor**
2. Execute o conteúdo completo de:
   ```
   supabase/migrations/20251121000001_create_instance_groups.sql
   ```

---

### **OPÇÃO 3: Script Consolidado (Aplicar Tudo de Uma Vez)**

Se preferir aplicar tudo de uma vez, use o arquivo consolidado:

1. Acesse **SQL Editor** no Supabase
2. Execute o conteúdo de:
   ```
   aplicar-migracao-instance-groups.sql
   ```
   (Este arquivo já contém a migração corrigida)

---

## 🔍 Verificação Pós-Aplicação

Após aplicar as migrações, verifique se as tabelas foram criadas:

```sql
-- Verificar tabela de janelas de horário
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'broadcast_time_windows';

-- Verificar tabela de grupos de instâncias
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'instance_groups';

-- Verificar policies RLS
SELECT * FROM pg_policies 
WHERE tablename IN ('broadcast_time_windows', 'instance_groups');
```

---

## ⚠️ Importante

1. **Ordem de Aplicação:** As migrações devem ser aplicadas na ordem numérica (timestamp)
   - `20251121000000_*` primeiro
   - `20251121000001_*` depois

2. **Dependências:** Ambas as migrações dependem de:
   - Tabela `organizations` existente
   - Função `get_user_organization()` existente
   - Função `has_role()` existente
   - Função `is_pubdigital_user()` existente

3. **RLS Policies:** As policies usam funções auxiliares que devem existir no banco

---

## 🐛 Troubleshooting

### Erro: "Could not find the table 'public.instance_groups'"
- **Causa:** Migração não foi aplicada
- **Solução:** Aplicar a migração `20251121000001_create_instance_groups.sql`

### Erro: "function get_user_organization does not exist"
- **Causa:** Função auxiliar não existe
- **Solução:** Verificar se a migração base do sistema foi aplicada

### Erro: "permission denied for table instance_groups"
- **Causa:** Policies RLS não foram criadas corretamente
- **Solução:** Re-executar a parte de policies da migração

---

## 📝 Notas para o Lovable

- As migrações estão na pasta padrão: `supabase/migrations/`
- Nomes seguem o padrão: `YYYYMMDDHHMMSS_description.sql`
- Todas as migrações são **idempotentes** (usam `IF NOT EXISTS`)
- As policies podem ser recriadas sem problemas (usam `DROP POLICY IF EXISTS`)

---

## ✅ Checklist de Deploy

- [ ] Migração `20251121000000_create_broadcast_time_windows.sql` aplicada
- [ ] Migração `20251121000001_create_instance_groups.sql` aplicada
- [ ] Tabelas criadas e visíveis no Supabase
- [ ] Policies RLS funcionando
- [ ] Teste de criação de grupo de instâncias funcionando
- [ ] Teste de criação de janela de horário funcionando

---

**Data de Criação:** 2025-01-21  
**Última Atualização:** 2025-01-21

