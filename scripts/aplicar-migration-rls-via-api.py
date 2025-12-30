#!/usr/bin/env python3
"""
Script para aplicar migration RLS Post-Sale via Supabase REST API
Usa Management API para executar SQL diretamente
"""

import os
import sys
import requests
import json
from pathlib import Path

# Configurações
PROJECT_ID = "ogeljmbhqxpfjbpnbwog"
ACCESS_TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN", "sbp_65ea725d285d73d58dc277c200fbee1975f01b9f")
MIGRATION_FILE = Path(__file__).parent.parent / "supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql"

def apply_migration():
    """Aplica migration via Supabase Management API"""
    
    print("╔════════════════════════════════════════╗")
    print("║  Aplicar Migration RLS Post-Sale      ║")
    print("║  (via Supabase Management API)        ║")
    print("╚════════════════════════════════════════╝")
    print()
    
    # Ler SQL
    if not MIGRATION_FILE.exists():
        print(f"❌ Arquivo não encontrado: {MIGRATION_FILE}")
        sys.exit(1)
    
    with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print(f"📄 Migration: {MIGRATION_FILE.name}")
    print(f"🔗 Projeto: {PROJECT_ID}")
    print()
    
    # Tentar aplicar via Management API
    # Nota: Supabase Management API não tem endpoint direto para SQL
    # Vamos usar o método de criar uma migration temporária e aplicar
    
    print("⚠️  Supabase Management API não suporta execução direta de SQL")
    print("📋 Aplicando via método alternativo...")
    print()
    
    # Método: Usar Supabase CLI via subprocess
    import subprocess
    
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Criar diretório temporário
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    try:
        temp_migrations = Path(temp_dir) / "supabase" / "migrations"
        temp_migrations.mkdir(parents=True, exist_ok=True)
        
        # Copiar migration
        shutil.copy(MIGRATION_FILE, temp_migrations / MIGRATION_FILE.name)
        
        # Executar via CLI
        os.chdir(temp_dir)
        
        print("🔗 Linkando projeto...")
        link_result = subprocess.run(
            ["supabase", "link", "--project-ref", PROJECT_ID, "--yes"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if link_result.returncode != 0:
            print(f"❌ Erro ao linkar projeto: {link_result.stderr}")
            sys.exit(1)
        
        print("⚡ Aplicando migration...")
        push_result = subprocess.run(
            ["supabase", "db", "push", "--include-all"],
            input="y\n",
            capture_output=True,
            text=True,
            timeout=180
        )
        
        if push_result.returncode == 0:
            print()
            print("✅ Migration aplicada com sucesso!")
            return 0
        else:
            print()
            print("❌ Erro ao aplicar migration:")
            print(push_result.stderr[-500:])  # Últimas 500 linhas
            print()
            print("💡 Tente aplicar manualmente via Supabase Dashboard:")
            print(f"   https://supabase.com/dashboard/project/{PROJECT_ID}/sql/new")
            return 1
            
    finally:
        os.chdir(project_root)
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    sys.exit(apply_migration())

