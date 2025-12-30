/**
 * Normaliza nomes de colunas do Excel para facilitar detecção
 * Remove acentos, espaços, converte para minúsculas
 */
export function normalizeColumnName(columnName: string): string {
  if (!columnName) return '';
  
  return columnName
    .toString()
    .trim()
    .toLowerCase()
    // Remove acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove espaços e caracteres especiais
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Encontra valor de coluna no objeto Excel normalizando o nome
 * Tenta várias variações do nome da coluna
 */
export function findColumnValue(row: any, possibleNames: string[]): string {
  if (!row) return '';
  
  // Primeiro, tentar nomes exatos (case-insensitive)
  for (const name of possibleNames) {
    // Tentar nome exato (case-insensitive)
    const exactMatch = Object.keys(row).find(
      key => key.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (exactMatch && row[exactMatch]) {
      return String(row[exactMatch]).trim();
    }
    
    // Tentar nome normalizado
    const normalizedName = normalizeColumnName(name);
    const normalizedMatch = Object.keys(row).find(
      key => normalizeColumnName(key) === normalizedName
    );
    if (normalizedMatch && row[normalizedMatch]) {
      return String(row[normalizedMatch]).trim();
    }
  }
  
  return '';
}

