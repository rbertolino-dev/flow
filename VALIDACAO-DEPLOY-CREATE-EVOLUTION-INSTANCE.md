# ✅ Validação do Deploy - create-evolution-instance

## 📋 Status do Deploy

**Data/Hora:** 2025-12-23 12:07:20  
**Status:** ✅ **ACTIVE**  
**ID da Função:** `38725ba0-76b7-4deb-b34f-2c5c167f8bf6`  
**Tamanho do Script:** 70.23kB  
**Versões Deployadas:** 38

---

## ✅ Verificações Realizadas

### 1. Deploy Automático
- ✅ Supabase CLI instalado e funcionando
- ✅ Projeto linkado: `ogeljmbhqxpfjbpnbwog`
- ✅ Função deployada com sucesso
- ✅ Status: **ACTIVE**

### 2. Código Atualizado
- ✅ Logs detalhados implementados
- ✅ Tratamento de erros melhorado
- ✅ Validação de variáveis de ambiente
- ✅ Retry automático em caso de conflito de UUID

### 3. Funcionalidades Implementadas
- ✅ Validação de campos obrigatórios
- ✅ Verificação de limites da organização
- ✅ Criação de instância via Evolution API
- ✅ Extração de QR Code
- ✅ Geração de webhook secret (UUID)
- ✅ Inserção no banco de dados
- ✅ Configuração de webhook na Evolution

---

## 🔍 Como Verificar Logs

### Via Supabase Dashboard:
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Clique em `create-evolution-instance`
3. Vá na aba **Logs**
4. Os logs terão prefixo `[CREATE-EVOLUTION-INSTANCE]` para facilitar busca

### Via CLI:
```bash
supabase functions logs create-evolution-instance
```

---

## 🧪 Teste Manual

Para testar a função, você pode:

1. **Via Interface:**
   - Vá em Configurações → Integrações → WhatsApp
   - Clique em "Nova Instância"
   - Preencha os dados e tente criar

2. **Via Dashboard (Invoke):**
   - Acesse a função no Dashboard
   - Clique em **Invoke**
   - Use este JSON de teste:
   ```json
   {
     "apiUrl": "https://sua-evolution-api.com",
     "apiKey": "sua-api-key",
     "instanceName": "teste-instancia",
     "organizationId": "uuid-da-organizacao",
     "userId": "uuid-do-usuario"
   }
   ```

---

## 📊 Logs Esperados

Quando a função for chamada, você verá logs como:

```
[CREATE-EVOLUTION-INSTANCE] Iniciando requisição
[CREATE-EVOLUTION-INSTANCE] Body recebido: {...}
[CREATE-EVOLUTION-INSTANCE] Criando cliente Supabase
[CREATE-EVOLUTION-INSTANCE] Verificando limites para org: ...
[CREATE-EVOLUTION-INSTANCE] Limite verificado, pode criar: true
[CREATE-EVOLUTION-INSTANCE] Gerando webhook secret
[CREATE-EVOLUTION-INSTANCE] UUID gerado: ...
[CREATE-EVOLUTION-INSTANCE] Salvando no banco de dados
[CREATE-EVOLUTION-INSTANCE] Configuração salva com sucesso: ...
```

---

## ⚠️ Possíveis Erros e Soluções

### Erro: "Erro ao verificar limites da organização"
- **Causa:** Função RPC `can_create_evolution_instance` não existe ou erro na query
- **Solução:** Verificar se a migration foi aplicada

### Erro: "Já existe uma instância com o nome..."
- **Causa:** Nome de instância duplicado na organização
- **Solução:** Escolher outro nome

### Erro: "Erro ao salvar configuração"
- **Causa:** Problema com inserção no banco (constraint, tipo de dado, etc.)
- **Solução:** Verificar logs detalhados para código do erro PostgreSQL

### Erro: "Erro ao criar instância Evolution"
- **Causa:** Problema na comunicação com Evolution API
- **Solução:** Verificar URL e API Key da Evolution

---

## ✅ Próximos Passos

1. **Testar criação de instância:**
   - Tente criar uma instância via interface
   - Verifique os logs se houver erro

2. **Monitorar logs:**
   - Acompanhe os logs nas primeiras tentativas
   - Verifique se os logs detalhados estão aparecendo

3. **Validar funcionamento:**
   - Se criar com sucesso, verifique se aparece na lista
   - Teste a conexão da instância

---

## 📝 Informações Técnicas

- **Projeto:** ogeljmbhqxpfjbpnbwog
- **URL da Função:** https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/create-evolution-instance
- **Método:** POST
- **Headers CORS:** Configurados
- **Timeout:** Padrão do Supabase (60s)

---

**Deploy realizado com sucesso! ✅**

