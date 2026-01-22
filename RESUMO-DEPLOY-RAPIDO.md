# ⚡ Resumo Rápido - Deploy `process-scheduled-campaigns`

## 🎯 3 Passos Simples

### 1️⃣ Deploy da Edge Function (Dashboard)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em **Edge Functions** → **Create a new function**
3. Nome: `process-scheduled-campaigns`
4. Copie TODO o conteúdo de: `supabase/functions/process-scheduled-campaigns/index.ts`
5. Cole no editor e clique em **Deploy**

### 2️⃣ Executar SQL Script

1. No Dashboard, vá em **SQL Editor**
2. Abra: `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor e clique em **Run**

### 3️⃣ Verificar

1. Aguarde 1-2 minutos
2. Vá em **Edge Functions** → `process-scheduled-campaigns` → **Logs**
3. Deve aparecer logs a cada minuto: `📅 [process-scheduled-campaigns] Iniciando verificação...`

---

## ✅ Checklist Rápido

- [ ] Função aparece no Dashboard (status: Active)
- [ ] SQL script executado sem erros
- [ ] Logs aparecem a cada minuto
- [ ] Teste: Criar campanha agendada e verificar início automático

---

## 📖 Guia Completo

Para instruções detalhadas, veja: `GUIA-DEPLOY-PROCESS-SCHEDULED-CAMPAIGNS.md`

---

**Tempo estimado:** 5-10 minutos
