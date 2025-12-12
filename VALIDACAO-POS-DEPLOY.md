# ✅ Validação Pós-Deploy - Evolution Providers

**Data:** 12/12/2025  
**Status:** Deploy realizado ✅

## 🧪 Checklist de Validação

Execute estes testes para garantir que tudo está funcionando:

### 1️⃣ Verificação no Banco de Dados

**No Supabase Dashboard:**

- [ ] **Table Editor:**
  - [ ] Tabela `evolution_providers` existe
  - [ ] Tabela `organization_evolution_provider` existe

- [ ] **Database > Functions:**
  - [ ] Função `get_organization_evolution_provider` existe
  - [ ] Função `organization_has_evolution_provider` existe

- [ ] **Authentication > Policies:**
  - [ ] Policies para `evolution_providers` criadas
  - [ ] Policies para `organization_evolution_provider` criadas

---

### 2️⃣ Teste como Super Admin

**Criar Provider:**
1. Acesse como super admin
2. Vá em **Super Admin Dashboard**
3. Clique em **"Providers Evolution"**
4. Clique em **"Novo Provider"**
5. Preencha:
   - Nome: "Test Provider"
   - URL: "https://api.evolution.com" (ou URL real)
   - API Key: "test-key" (ou key real)
   - Descrição: "Provider de teste"
6. Marque como **Ativo**
7. Clique em **"Criar"**
8. ✅ Verifique se aparece na lista

**Atribuir Provider a Organização:**
1. No **Super Admin Dashboard**
2. Selecione uma organização
3. Aba **"Limites"**
4. Seção **"Provider Evolution (WhatsApp)"**
5. Selecione o provider criado
6. Clique em **"Salvar Configurações"**
7. ✅ Verifique se foi salvo

---

### 3️⃣ Teste como Usuário da Organização

**Criar Instância WhatsApp:**
1. Acesse como usuário da organização que tem provider configurado
2. Vá em **Configurações** > **WhatsApp**
3. Clique em **"Nova Instância"**
4. ✅ **VERIFIQUE:**
   - Campos de **URL da API** e **API Key** NÃO aparecem
   - Aparece mensagem: "Provider pré-configurado: [Nome do Provider]"
   - Só precisa informar o **Nome da Instância**
5. Preencha o nome (ex: "minha-instancia")
6. Marque **"Criar com QR Code"** (opcional)
7. Clique em **"Criar"** ou **"Criar com QR"**
8. ✅ Verifique se a instância foi criada

**Visualizar Instâncias:**
1. Na lista de instâncias
2. ✅ **VERIFIQUE:**
   - A URL NÃO aparece
   - Aparece: "Provider gerenciado pela administração"

**Editar Instância:**
1. Clique em editar uma instância
2. ✅ **VERIFIQUE:**
   - Se há provider configurado, URL/API Key NÃO aparecem
   - Aparece mensagem: "Provider gerenciado pela administração"
   - Só pode editar o nome da instância

---

### 4️⃣ Teste de Segurança

**Verificar que usuário não vê dados sensíveis:**
1. Como usuário, abra o console do navegador (F12)
2. Tente acessar diretamente a tabela `evolution_providers`
3. ✅ **VERIFIQUE:** Deve retornar erro de permissão ou vazio

**Verificar RLS:**
1. No Supabase Dashboard > Authentication > Policies
2. ✅ **VERIFIQUE:** Apenas super admins têm acesso direto

---

## ✅ Resultado Esperado

### ✅ Funcionando Corretamente:
- Super admin pode criar/editar/excluir providers
- Super admin pode atribuir providers a organizações
- Usuários NÃO veem URL/API key quando há provider configurado
- Usuários só precisam informar nome da instância
- Instâncias são criadas com sucesso usando provider pré-configurado
- Segurança RLS funcionando corretamente

### ❌ Se algo não funcionar:

**Usuário ainda vê URL/API key:**
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Verifique se a migration foi aplicada completamente
- Verifique se a organização tem provider configurado

**Erro ao criar instância:**
- Verifique se o provider está ativo
- Verifique se a URL e API key do provider estão corretas
- Verifique os logs no console do navegador

**Provider não aparece no dropdown:**
- Verifique se o provider está marcado como "ativo"
- Verifique se você está logado como super admin

---

## 📊 Status Final

- [ ] Todas as verificações do banco concluídas
- [ ] Teste como super admin concluído
- [ ] Teste como usuário concluído
- [ ] Teste de segurança concluído
- [ ] Tudo funcionando corretamente

---

## 🎉 Pronto!

Se todos os testes passaram, o sistema está funcionando perfeitamente!

**Funcionalidades disponíveis:**
- ✅ Super admin pode gerenciar providers Evolution
- ✅ Super admin pode atribuir providers a organizações
- ✅ Usuários criam instâncias sem ver URL/API key
- ✅ Segurança implementada e funcionando


