# 📋 Gerador de Orçamentos

**Data de criação:** 2025-12-20  
**Versão:** 1.0

---

## 🎯 Visão Geral

O Gerador de Orçamentos permite criar orçamentos profissionais com:
- Múltiplos produtos (do Supabase)
- Múltiplos serviços (do PostgreSQL)
- Imagem de fundo configurável por organização
- Geração automática de PDF
- Envio via WhatsApp
- Histórico completo de orçamentos

---

## 🚀 Como Usar

### 1. Criar Novo Orçamento

1. Acesse **Orçamentos** no menu lateral
2. Clique em **Novo Orçamento**
3. Preencha os campos:
   - **Cliente**: Selecione um lead/cliente
   - **Produtos**: Adicione produtos do catálogo
   - **Serviços**: Adicione serviços cadastrados
   - **Forma de Pagamento**: Selecione uma ou mais opções
   - **Validade**: Defina quantos dias o orçamento é válido
   - **Data de Entrega**: Opcional
   - **Local de Entrega**: Opcional
   - **Observações**: Texto livre

4. Clique em **Criar Orçamento**
5. O PDF será gerado automaticamente

### 2. Adicionar Produtos

1. No campo **Produtos**, use a busca para encontrar produtos
2. Selecione um produto da lista
3. Defina a **Quantidade**
4. Opcionalmente, defina um **Valor** diferente do cadastrado
5. Clique em **Adicionar**
6. O produto aparecerá na lista com subtotal calculado

**Editar produto adicionado:**
- Altere a quantidade ou valor diretamente na lista
- O subtotal será recalculado automaticamente
- Clique no X para remover

### 3. Adicionar Serviços

1. No campo **Serviços**, use a busca para encontrar serviços
2. Selecione um serviço da lista
3. Defina a **Quantidade**
4. Opcionalmente, defina um **Valor** diferente do cadastrado
5. Clique em **Adicionar**
6. O serviço aparecerá na lista com subtotal calculado

**Nota:** Serviços são gerenciados no PostgreSQL do servidor Hetzner.

### 4. Acréscimos e Descontos

1. No campo **Acréscimos/Descontos**, digite o valor
2. Use valores **positivos** para acréscimos
3. Use valores **negativos** para descontos (ex: -100.00)
4. O total será recalculado automaticamente

### 5. Visualizar Orçamento

1. Na lista de orçamentos, clique no ícone de **olho** (👁️)
2. Visualize todos os detalhes do orçamento
3. Use os botões para:
   - **Regenerar PDF**: Gera um novo PDF
   - **Download**: Baixa o PDF
   - **Enviar via WhatsApp**: Envia para o cliente

### 6. Regenerar PDF

1. Na lista de orçamentos, clique no ícone de **refresh** (🔄)
2. Ou na visualização, clique em **Regenerar PDF**
3. O PDF será gerado novamente com os dados atualizados

### 7. Enviar via WhatsApp

1. Na lista ou visualização, clique em **Enviar via WhatsApp**
2. Selecione a instância do WhatsApp
3. Clique em **Enviar**
4. O orçamento será enviado como documento PDF para o telefone do cliente

**Requisitos:**
- Instância WhatsApp conectada
- Cliente com telefone cadastrado
- PDF gerado (será gerado automaticamente se não existir)

---

## 🎨 Configurar Imagem de Fundo

**Nota:** Esta funcionalidade será implementada em breve.

A imagem de fundo será configurável por organização e aplicada automaticamente nos PDFs.

---

## 📊 Estrutura do PDF

O PDF gerado contém:

1. **Cabeçalho**
   - Título "ORÇAMENTO"
   - Número do orçamento
   - Data de emissão

2. **Dados do Cliente**
   - Nome
   - Telefone
   - Email
   - Empresa

3. **Tabela de Produtos**
   - Descrição
   - Quantidade
   - Valor Unitário
   - Subtotal
   - **Subtotal de Produtos** (soma)

4. **Tabela de Serviços**
   - Descrição
   - Quantidade
   - Valor Unitário
   - Subtotal
   - **Subtotal de Serviços** (soma)

5. **Acréscimos/Descontos**
   - Valor (se houver)

6. **Total Geral**
   - Soma de todos os valores

7. **Forma de Pagamento**
   - Lista de formas selecionadas

8. **Validade**
   - Data de expiração do orçamento

9. **Entrega**
   - Data de entrega (se informada)
   - Local de entrega (se informado)

10. **Observações**
    - Texto livre

11. **Rodapé**
    - Data e hora de geração
    - Número da página

---

## 🔢 Formas de Pagamento Disponíveis

- Dinheiro
- PIX
- Cartão de Crédito
- Cartão de Débito
- Boleto
- Transferência Bancária
- Parcelado

Você pode selecionar múltiplas formas de pagamento.

---

## 📝 Número do Orçamento

O número do orçamento é gerado automaticamente no formato:
```
ORG-YYYYMM-NNNN
```

Onde:
- **ORG**: Primeiros 4 caracteres do ID da organização
- **YYYYMM**: Ano e mês atual
- **NNNN**: Número sequencial do mês (0001, 0002, etc.)

Exemplo: `A1B2-202512-0001`

---

## 🗂️ Histórico de Orçamentos

Todos os orçamentos criados são salvos e podem ser:
- Visualizados
- Regenerados (novo PDF)
- Enviados novamente via WhatsApp
- Baixados
- Excluídos

**Busca:**
- Por número do orçamento
- Por nome do cliente

**Status:**
- **Válido**: Orçamento ainda não expirou
- **Expira em X dias**: Expira em breve (7 dias ou menos)
- **Expirado**: Orçamento expirado

---

## ⚙️ Configuração Técnica

### Produtos

- Gerenciados no Supabase (tabela `products`)
- Acessíveis via hook `useProducts`
- Filtrados por organização

### Serviços

- Gerenciados no PostgreSQL do servidor Hetzner (tabela `services`)
- Acessíveis via Edge Function `get-services`
- Filtrados por organização

### PDF

- Gerado usando jsPDF
- Formato A4 (210x297mm)
- Suporta imagem de fundo (JPEG/PNG)
- Armazenado no Supabase Storage

### Envio WhatsApp

- Via Evolution API
- Enviado como documento PDF
- Mensagem personalizada com informações do orçamento

---

## 🐛 Troubleshooting

### Erro: "Nenhum produto encontrado"

**Solução:** Cadastre produtos em **Configurações → Produtos**

### Erro: "Nenhum serviço encontrado"

**Solução:** 
1. Verifique se o PostgreSQL está configurado
2. Cadastre serviços via Edge Function ou diretamente no banco

### Erro: "PDF não encontrado"

**Solução:** Clique em **Regenerar PDF** para criar o PDF novamente

### Erro: "Instância WhatsApp não encontrada"

**Solução:** Configure uma instância WhatsApp em **Configurações → Instâncias WhatsApp**

### Erro ao enviar via WhatsApp

**Possíveis causas:**
- Instância desconectada
- Telefone do cliente inválido
- Número não cadastrado no WhatsApp

**Solução:**
1. Verifique se a instância está conectada
2. Verifique se o telefone do cliente está correto
3. Tente novamente

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs no console do navegador
2. Verifique os logs da Edge Function no Supabase Dashboard
3. Entre em contato com o suporte técnico

---

**Última atualização:** 2025-12-20


