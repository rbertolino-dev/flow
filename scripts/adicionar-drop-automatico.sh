#!/bin/bash
# Script para adicionar DROP IF EXISTS antes de CREATE em todas as migrations

echo "🔧 Adicionando DROP IF EXISTS automático em todas as migrations..."

python3 << 'PYTHON'
import re
import glob
import os

def add_drop_before_create(content):
    """Adiciona DROP IF EXISTS antes de cada CREATE"""
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        original_line = line
        
        # CREATE POLICY "nome" ON tabela
        if re.search(r'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([^\s]+)', line, re.IGNORECASE):
            match = re.search(r'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([^\s]+)', line, re.IGNORECASE)
            policy_name = match.group(1)
            table_name = match.group(2)
            
            # Verificar se já tem DROP antes
            has_drop = False
            for j in range(max(0, i-5), i):
                if f'DROP POLICY IF EXISTS "{policy_name}"' in lines[j] and table_name in lines[j]:
                    has_drop = True
                    break
            
            if not has_drop:
                new_lines.append(f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};')
        
        # CREATE TRIGGER nome ON tabela
        elif re.search(r'CREATE\s+TRIGGER\s+(\w+)\s+ON\s+([^\s]+)', line, re.IGNORECASE):
            match = re.search(r'CREATE\s+TRIGGER\s+(\w+)\s+ON\s+([^\s]+)', line, re.IGNORECASE)
            trigger_name = match.group(1)
            table_name = match.group(2)
            
            # Verificar se já tem DROP antes
            has_drop = False
            for j in range(max(0, i-5), i):
                if f'DROP TRIGGER IF EXISTS {trigger_name}' in lines[j] and table_name in lines[j]:
                    has_drop = True
                    break
            
            if not has_drop:
                new_lines.append(f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name} CASCADE;')
        
        # CREATE FUNCTION nome() (sem OR REPLACE)
        elif re.search(r'CREATE\s+FUNCTION\s+([^(]+)\(', line, re.IGNORECASE) and 'OR REPLACE' not in line.upper():
            match = re.search(r'CREATE\s+FUNCTION\s+([^(]+)\(', line, re.IGNORECASE)
            func_name = match.group(1).strip()
            
            # Verificar se já tem DROP antes
            has_drop = False
            for j in range(max(0, i-5), i):
                if f'DROP FUNCTION IF EXISTS {func_name}' in lines[j]:
                    has_drop = True
                    break
            
            if not has_drop:
                new_lines.append(f'DROP FUNCTION IF EXISTS {func_name} CASCADE;')
        
        new_lines.append(line)
        i += 1
    
    return '\n'.join(new_lines)

# Processar todas as migrations
migration_files = sorted(glob.glob("supabase/migrations/*.sql"))
print(f"📝 Processando {len(migration_files)} migrations...")

processed = 0
for mig_file in migration_files:
    # Pular backups
    if mig_file.endswith('.backup'):
        continue
    
    with open(mig_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Adicionar DROP IF EXISTS
    new_content = add_drop_before_create(content)
    
    # Só salvar se mudou
    if new_content != content:
        # Salvar backup
        backup_file = mig_file + '.backup'
        if not os.path.exists(backup_file):
            with open(backup_file, 'w', encoding='utf-8') as f:
                f.write(content)
        
        # Salvar modificado
        with open(mig_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        processed += 1
        print(f"✅ {os.path.basename(mig_file)}")

print(f"\n✅ {processed} migrations processadas!")
PYTHON

echo ""
echo "🔄 Regenerando lotes com as migrations corrigidas..."
rm -rf migrations-lotes
./scripts/gerar-sql-com-lotes.sh > /dev/null 2>&1

echo "✅ Pronto! Agora as migrations têm DROP IF EXISTS automático."




