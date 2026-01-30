#!/usr/bin/env node
/**
 * Valida se a migração broadcast_campaigns_deleted_history foi executada com sucesso.
 * Usa a API REST do Supabase para verificar se a tabela existe.
 *
 * Uso: node scripts/validar-migracao-historico-excluidas.js
 * Ou:  ./scripts/validar-migracao-historico-excluidas.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carregar .env se existir
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ogeljmbhqxpfjbpnbwog.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ VITE_SUPABASE_PUBLISHABLE_KEY não encontrada. Carregue o .env ou defina a variável.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function validar() {
  console.log('🔍 Validando migração broadcast_campaigns_deleted_history...\n');

  try {
    // Tenta fazer um SELECT na tabela - se existir, retorna 200 (mesmo vazio)
    const { data, error } = await supabase
      .from('broadcast_campaigns_deleted_history')
      .select('id')
      .limit(1);

    if (error) {
      // Códigos que indicam tabela inexistente
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.error('❌ FALHA: A tabela broadcast_campaigns_deleted_history NÃO existe.');
        console.error('   Erro:', error.message);
        console.error('\n   Execute o script: scripts/aplicar-migracao-historico-campanhas-excluidas.sql');
        console.error('   no Supabase SQL Editor (https://supabase.com/dashboard).\n');
        process.exit(1);
      }
      // Outros erros (ex: RLS, permissão)
      console.error('⚠️  Erro ao consultar:', error.message);
      console.error('   Código:', error.code);
      // Se for erro de permissão/RLS, a tabela pode existir - tentamos outra abordagem
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        console.log('\n   (Erro de permissão/RLS - a tabela pode existir. Verifique manualmente no Supabase.)');
        process.exit(2);
      }
      process.exit(1);
    }

    console.log('✅ SUCESSO: A tabela broadcast_campaigns_deleted_history existe e está acessível.');
    console.log(`   Registros encontrados: ${Array.isArray(data) ? data.length : 0}`);
    console.log('\n   A migração foi executada corretamente. O Histórico de Excluídas está pronto.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message);
    process.exit(1);
  }
}

validar();
