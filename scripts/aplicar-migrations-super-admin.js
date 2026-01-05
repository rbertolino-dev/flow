#!/usr/bin/env node

/**
 * Script para aplicar migrations do Super Admin via Supabase Management API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Carregar variáveis de ambiente
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ogeljmbhqxpfjbpnbwog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  console.error('💡 Configure no arquivo .env ou exporte como variável de ambiente');
  process.exit(1);
}

// Criar cliente Supabase com SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migrations para aplicar
const migrations = [
  'supabase/migrations/20250131000003_fix_organization_limits_jsonb_validation.sql',
  'supabase/migrations/20250131000004_fix_organization_limits_rls_insert.sql',
];

async function applyMigration(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    return false;
  }

  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n📄 Aplicando: ${filePath}`);
  console.log('─'.repeat(60));

  try {
    // Executar SQL via RPC (se existir função exec_sql)
    // Caso contrário, usar API REST diretamente
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Se RPC não existir, tentar via fetch direto na API
      console.log('⚠️  RPC não disponível, tentando via API REST...');
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_query: sql }),
      });

      if (!response.ok) {
        // Última tentativa: usar psql se disponível
        console.log('⚠️  API REST não disponível, tentando via psql...');
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Obter connection string do Supabase
        const dbUrl = `postgresql://postgres.ogeljmbhqxpfjbpnbwog:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
        
        try {
          const { stdout, stderr } = await execAsync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`);
          if (stderr && !stderr.includes('NOTICE')) {
            throw new Error(stderr);
          }
          console.log('✅ Migration aplicada via psql!');
          return true;
        } catch (psqlError) {
          console.error('❌ Erro ao executar via psql:', psqlError.message);
          throw error;
        }
      } else {
        console.log('✅ Migration aplicada via API REST!');
        return true;
      }
    } else {
      console.log('✅ Migration aplicada via RPC!');
      return true;
    }
  } catch (err) {
    console.error('❌ Erro ao aplicar migration:', err.message);
    console.error('💡 Tente aplicar manualmente no Supabase Dashboard SQL Editor');
    return false;
  }
}

async function main() {
  console.log('🚀 Aplicando migrations do Super Admin...');
  console.log(`📦 Projeto: ${SUPABASE_URL}`);
  console.log('─'.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Sucesso: ${successCount}`);
  console.log(`❌ Falhas: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n💡 Se houver falhas, aplique manualmente no Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new');
    process.exit(1);
  } else {
    console.log('\n🎉 Todas as migrations foram aplicadas com sucesso!');
  }
}

main().catch(console.error);

