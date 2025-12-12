# 🚀 Deploy - Evolution Providers (Super Admin)

Este guia explica como fazer deploy das funcionalidades de gerenciamento de Evolution Providers pelo Super Admin.

## 📋 O que foi implementado

1. **Tabelas no banco de dados:**
   - `evolution_providers` - Armazena os providers Evolution disponíveis
   - `organization_evolution_provider` - Relaciona organizações com providers

2. **Funcionalidades:**
   - Painel do Super Admin para gerenciar providers Evolution
   - Configuração de provider por organização no painel de limites
   - Criação automática de instâncias usando provider pré-configurado
   - Segurança: usuários não veem/editam URL/API key quando há provider configurado

## ⚠️ IMPORTANTE: Execute na ordem abaixo

### 1️⃣ Aplicar Migrações no Banco de Dados

**Opção A - Via Supabase CLI (recomendado):**
```powershell
cd C:\Users\Rubens\lovable\agilize
supabase db push
```

**Opção B - Via Supabase Dashboard (manual):**
1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix
2. Vá em **SQL Editor** (menu lateral)
3. Execute as migrations na ordem:

   **a) Primeira migration:**
   - Abra o arquivo: `supabase/migrations/20250131000005_create_evolution_providers.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor
   - Clique em **RUN**

   **b) Segunda migration (segurança):**
   - Abra o arquivo: `supabase/migrations/20250131000006_secure_evolution_providers.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor
   - Clique em **RUN**

**Verificar se funcionou:**
- No Dashboard, vá em **Table Editor**
- Deve aparecer as tabelas:
  - ✅ `evolution_providers`
  - ✅ `organization_evolution_provider`
- Vá em **Database** > **Functions**
- Deve aparecer as funções:
  - ✅ `get_organization_evolution_provider`
  - ✅ `organization_has_evolution_provider`

---

### 2️⃣ Verificar Políticas RLS

As políticas RLS foram criadas automaticamente pelas migrations. Verifique:

1. No Dashboard, vá em **Authentication** > **Policies**
2. Procure por:
   - `evolution_providers` - Deve ter políticas para super admins
   - `organization_evolution_provider` - Deve ter políticas para super admins e org owners

---

### 3️⃣ Build do Frontend

```powershell
cd C:\Users\Rubens\lovable\agilize
npm run build
```

**Verificar se funcionou:**
- Deve compilar sem erros
- A pasta `dist/` deve ser criada/atualizada

---

### 4️⃣ Deploy do Frontend (Lovable)

Se estiver usando Lovable para deploy:
1. Faça commit das mudanças
2. Push para o repositório
3. O Lovable fará o deploy automaticamente

Ou siga o processo normal de deploy do Lovable.

---

### 5️⃣ Testar Funcionalidades

Após o deploy, teste:

1. **Super Admin - Gerenciar Providers:**
   - Acesse como super admin
   - Vá em Super Admin Dashboard
   - Clique em "Providers Evolution"
   - Crie um novo provider (nome, URL, API key)
   - Verifique se aparece na lista

2. **Super Admin - Atribuir Provider a Organização:**
   - Vá em Super Admin Dashboard
   - Selecione uma organização
   - Aba "Limites"
   - Na seção "Provider Evolution (WhatsApp)"
   - Selecione um provider
   - Salve

3. **Usuário - Criar Instância:**
   - Acesse como usuário da organização que tem provider configurado
   - Vá em Configurações > WhatsApp
   - Clique em "Nova Instância"
   - Verifique que:
     - ✅ Campos de URL e API Key NÃO aparecem
     - ✅ Aparece mensagem "Provider pré-configurado"
     - ✅ Só precisa informar o nome da instância
     - ✅ Instância é criada com sucesso

4. **Usuário - Ver Instâncias:**
   - Na lista de instâncias
   - Verifique que a URL NÃO aparece
   - Aparece "Provider gerenciado pela administração"

---

## 🔒 Segurança Implementada

✅ Usuários não veem URL/API key quando há provider configurado
✅ Usuários não podem editar URL/API key quando há provider configurado
✅ Políticas RLS impedem acesso direto a providers
✅ Funções RPC validam permissões antes de retornar dados
✅ Super admin mantém controle total

---

## ❌ Troubleshooting

**Erro ao aplicar migration:**
- Verifique se está conectado ao projeto correto no Supabase
- Verifique se não há conflitos com migrations anteriores
- Execute uma migration por vez

**Erro "policy already exists":**
- As policies podem já existir, isso é normal
- Continue com a próxima migration

**Usuário ainda vê URL/API key:**
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Verifique se a migration foi aplicada corretamente
- Verifique se a organização tem provider configurado

**Provider não aparece no dropdown:**
- Verifique se o provider está marcado como "ativo" (is_active = true)
- Verifique se você está logado como super admin

---

## ✅ Checklist Final

- [ ] Migrations aplicadas no banco de dados
- [ ] Tabelas criadas (`evolution_providers`, `organization_evolution_provider`)
- [ ] Funções RPC criadas
- [ ] Políticas RLS ativas
- [ ] Build do frontend concluído
- [ ] Deploy do frontend realizado
- [ ] Testado criação de provider pelo super admin
- [ ] Testado atribuição de provider a organização
- [ ] Testado criação de instância pelo usuário (sem ver URL/API key)
- [ ] Testado visualização de instâncias (sem ver URL)

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase Dashboard
2. Verifique o console do navegador (F12)
3. Verifique se todas as migrations foram aplicadas

---

**Última atualização:** 31/01/2025

