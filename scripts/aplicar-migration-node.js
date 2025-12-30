#!/usr/bin/env node

/**
 * Script para aplicar migration via Supabase Client
 * Usa @supabase/supabase-js para executar SQL diretamente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentar carregar variáveis de ambiente
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
} catch (e) {
  // dotenv não disponível, usar variáveis de ambiente do sistema
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas:');
  console.error('   VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('💡 Configure no arquivo .env:');
  console.error('   VITE_SUPABASE_URL=https://seu-projeto.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20251222190000_fix_onboarding_and_cadastro_errors.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Arquivo de migration não encontrado: ${migrationFile}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('🚀 Aplicando migration via Supabase API...');
console.log(`📄 Arquivo: ${migrationFile}`);
console.log('');

// Executar SQL via REST API usando rpc
async function applyMigration() {
  try {
    // Dividir SQL em blocos executáveis (cada DO $$ ... END $$;)
    const blocks = sql.split(/DO \$\$/).filter(block => block.trim());
    
    console.log(`📦 Encontrados ${blocks.length} blocos SQL para executar`);
    console.log('');

    // Executar cada bloco
    for (let i = 0; i < blocks.length; i++) {
      const block = 'DO $$' + blocks[i];
      console.log(`📤 Executando bloco ${i + 1}/${blocks.length}...`);
      
      // Executar via API REST usando função RPC exec_sql (se existir)
      // Ou usar método alternativo via Management API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: block }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Bloco ${i + 1} executado com sucesso`);
      } else {
        const error = await response.text();
        console.log(`⚠️  Bloco ${i + 1} falhou (pode ser que função RPC não exista)`);
        console.log(`   Erro: ${error.substring(0, 200)}`);
      }
    }

    console.log('');
    console.log('==========================================');
    console.log('⚠️  Execução via API pode não ter funcionado');
    console.log('==========================================');
    console.log('');
    console.log('📝 Execute manualmente no Supabase SQL Editor:');
    console.log(`   1. Acesse: ${SUPABASE_URL.replace('https://', 'https://app.').replace('.supabase.co', '.supabase.co/project/ogeljmbhqxpfjbpnbwog/sql/new')}`);
    console.log('   2. Cole o SQL do arquivo de migration');
    console.log('   3. Clique em "Run"');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    console.error('');
    console.error('📝 Execute manualmente no Supabase SQL Editor');
    process.exit(1);
  }
}

// Verificar se fetch está disponível (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Node.js 18+ é necessário (fetch API)');
  console.error('   Atualize o Node.js ou use outro método');
  process.exit(1);
}

applyMigration();

