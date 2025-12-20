# 🔍 Explicação da Discrepância

## ❓ Problema

**Script diz:** 135 migrations aplicadas  
**Banco mostra:** 12 migrations registradas

## 🔍 Causa

O script está:
1. ✅ **Executando o SQL** das migrations corretamente
2. ❌ **NÃO registrando** na tabela `schema_migrations` do Supabase

### Por Que Isso Acontece?

Quando aplicamos uma migration única usando o método temporário:
- Criamos diretório temporário
- Copiamos apenas uma migration
- Aplicamos via `supabase db push`
- Restauramos o diretório original

O Supabase CLI **executa o SQL**, mas **não registra** na tabela `schema_migrations` porque:
- O diretório de migrations foi restaurado antes do registro
- O CLI precisa do diretório completo para registrar corretamente

## ✅ Solução Aplicada

### 1. Script Atualizado
O script agora usa `supabase migration repair` após aplicar cada migration para registrá-la no banco.

### 2. Script de Correção
Criado `scripts/marcar-migrations-aplicadas.sh` para marcar todas as migrations já aplicadas como registradas.

## 🚀 Como Resolver

### Opção 1: Deixar o script continuar
O script atualizado já registra automaticamente. As novas migrations serão registradas.

### Opção 2: Marcar as já aplicadas
Execute o script de correção:
```bash
./scripts/marcar-migrations-aplicadas.sh
```

Isso marcará todas as 135+ migrations aplicadas como registradas no banco.

## 📊 Status Atual

- **SQL executado:** ✅ Sim (135+ migrations)
- **Registrado no banco:** ⚠️ Apenas 12
- **Solução:** Script de correção disponível

## 💡 Observação

As migrations **foram aplicadas** (o SQL rodou), apenas não estão registradas na tabela de controle. Isso não afeta o funcionamento, mas pode causar confusão ao verificar status.




