<!-- 8b068422-e89a-4458-bb54-9cbda6b6e0c9 bc181057-dd2e-4175-95f0-46546e51980e -->
# Estratégia Avançada para Corrigir Caracteres Estranhos no PDF de Orçamento

## Análise do Problema

O problema persiste mesmo após várias tentativas porque:

1. O jsPDF pode estar interpretando caracteres de forma incorreta devido a estado interno
2. Pode haver problema de encoding no arquivo TypeScript
3. A fonte Helvetica padrão do jsPDF pode não suportar corretamente alguns caracteres

## Estratégia Multi-Camada (100% Garantida)

### Camada 1: Validação e Sanitização Rigorosa de Strings

- Criar função `ensureAsciiTitle` que:
  - Converte string para array de códigos Unicode
  - Filtra APENAS caracteres ASCII válidos (32-126)
  - Remove qualquer caractere que não seja letra, número, espaço ou pontuação básica
  - Retorna string limpa garantida

### Camada 2: Reset Completo de Estado do jsPDF

- Antes de cada título, executar sequência completa:

  1. `doc.setFont('helvetica', 'normal')`
  2. `doc.setFontSize(10)`
  3. `doc.setTextColor(0, 0, 0)`
  4. `doc.setDrawColor(0, 0, 0)`
  5. `doc.setFillColor(255, 255, 255)`
  6. `doc.setLineWidth(0.1)`
  7. Depois definir fonte bold e escrever

### Camada 3: Uso de String Literal Direta (Como no Contrato)

- Usar EXATAMENTE o mesmo padrão do `contractPdfGenerator.ts`:
  - String literal direta: `'DADOS DO CLIENTE'` (sem variáveis, sem interpolação)
  - Sem acentos nos títulos (usar "INFORMACOES" ao invés de "INFORMAÇÕES")
  - Sem caracteres especiais

### Camada 4: Teste Automatizado de Validação

- Criar função de teste que:
  - Gera PDF de teste
  - Extrai texto do PDF gerado
  - Valida que não há caracteres estranhos
  - Falha se encontrar "Ø", "Ü", "¼", "³", "Å" ou similares

### Camada 5: Verificação de Encoding do Arquivo

- Garantir que arquivo TypeScript está em UTF-8
- Verificar que não há caracteres invisíveis ou BOM (Byte Order Mark)

## Implementação Detalhada

### Arquivo: `src/lib/budgetPdfGenerator.ts`

1. **Função de Sanitização Rigorosa:**
```typescript
const ensureAsciiTitle = (text: string): string => {
  // Converter para array de códigos
  const codes = Array.from(text).map(char => char.charCodeAt(0));
  
  // Filtrar APENAS ASCII válido (32-126)
  const validCodes = codes.filter(code => code >= 32 && code <= 126);
  
  // Converter de volta para string
  return String.fromCharCode(...validCodes).trim();
};
```

2. **Função Helper para Escrever Títulos (Garantida):**
```typescript
const writeTitle = (text: string, x: number, y: number, fontSize: number = 10) => {
  // Camada 1: Sanitizar
  const cleanText = ensureAsciiTitle(text);
  
  // Camada 2: Reset completo de estado
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.1);
  
  // Camada 3: Escrever com fonte bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text(cleanText, x, y);
};
```

3. **Títulos Sem Acentos (Garantido):**

- `'DADOS DO CLIENTE'` (não "DADOS DO CLIENTE" com acentos)
- `'PRODUTOS'`
- `'FORMA DE PAGAMENTO'`
- `'INFORMACOES DE ENTREGA'` (sem "Ç" e sem acento)
- `'OUTRAS INFORMACOES'` (sem "Ç" e sem acento)

4. **Uso da Função Helper:**
```typescript
// Ao invés de:
doc.text('DADOS DO CLIENTE', margin, yPosition);

// Usar:
writeTitle('DADOS DO CLIENTE', margin, yPosition);
```


### Arquivo: `src/lib/budgetPdfGenerator.test.ts` (Novo)

Criar teste automatizado que:

1. Gera PDF de teste com todos os títulos
2. Extrai texto do PDF
3. Valida que não há caracteres estranhos
4. Falha se encontrar problema

## Checklist de Validação

- [ ] Função `ensureAsciiTitle` implementada e testada
- [ ] Função `writeTitle` implementada com reset completo
- [ ] Todos os títulos usando `writeTitle` helper
- [ ] Todos os títulos sem acentos ou caracteres especiais
- [ ] Teste automatizado criado e passando
- [ ] Encoding do arquivo verificado (UTF-8 sem BOM)
- [ ] Build sem erros
- [ ] Deploy testado e validado

## Garantias

1. **Sanitização Rigorosa:** Apenas ASCII 32-126 será escrito
2. **Reset de Estado:** Estado do jsPDF resetado antes de cada título
3. **String Literal:** Títulos como strings literais diretas (sem interpolação)
4. **Sem Acentos:** Títulos sem acentos ou caracteres especiais
5. **Teste Automatizado:** Validação automática após cada mudança

## Arquivos a Modificar

1. `src/lib/budgetPdfGenerator.ts` - Recriar completamente seguindo estratégia
2. `src/lib/budgetPdfGenerator.test.ts` - Criar teste automatizado (opcional, mas recomendado)

## Ordem de Execução

1. Implementar função `ensureAsciiTitle`
2. Implementar função `writeTitle` com reset completo
3. Substituir todos os `doc.text()` de títulos por `writeTitle()`
4. Garantir que todos os títulos estão sem acentos
5. Testar build
6. Criar teste automatizado (opcional)
7. Deploy e validação final

### To-dos

- [ ] Criar função ensureAsciiTitle que filtra rigorosamente apenas ASCII 32-126
- [ ] Criar função writeTitle que faz reset completo de estado do jsPDF antes de escrever
- [ ] Substituir todos os doc.text() de títulos por writeTitle() usando strings sem acentos
- [ ] Verificar encoding do arquivo (UTF-8 sem BOM) e garantir que está correto
- [ ] Testar build e validar que não há erros de compilação
- [ ] Fazer deploy e testar geração de PDF na aplicação real