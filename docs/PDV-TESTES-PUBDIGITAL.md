# Testes do PDV na Pubdigital

Registro dos cenários executados em 6 de outubro de 2026 na organização **pubdgital** (`8127ebc7-f911-4dcc-90d0-9d2cd851d469`), no site publicado `https://agilizeflow.com.br`.

Produto usado: fanta laranja, R$ 10. Serviço: E2E PDV Servico 051026. Cliente: Cliente Cenários PDV. Vendedor da comissão: PubDigital.

As vendas criadas nestas rodadas foram excluídas no fim. A configuração do PDV foi restaurada para o estado anterior. O estoque da fanta terminou em 22.

## Como repetir

```bash
python3 scripts/validar-pdv-cenarios-pubdigital.py
python3 scripts/validar-pdv-lacunas-pubdigital.py
PLAYWRIGHT_BASE_URL=https://agilizeflow.com.br npx playwright test tests/e2e/pdv.spec.ts --config=playwright.deployed.config.ts --project=chromium-functional
```

O primeiro script cobre vendas, descontos, acréscimos, histórico e caixa consolidado. O segundo cobre as lacunas (reativação, caixa, estoque, nota fiscal). O Playwright cobre a tela.

## API — vendas, descontos e consolidado

Script: `scripts/validar-pdv-cenarios-pubdigital.py`. Resultado: passou.

Configuração gravada e lida de volta:

- Observações, conta e categoria vendas
- Cliente padrão
- Venda simples
- Comissão obrigatória de 10%
- Ocultar meio de pagamento
- Código de barras, bloqueio de falta e comissão fixa
- Configuração final da loja restaurada depois

Desconto por forma:

- Método inválido, percentual acima de 100 e desconto zero são ignorados
- Pix 10%, cheque 11%, permuta 10% e crediário 10%
- Boleto sem desconto

Vendas:

- PIX
- Dinheiro
- Cartão de crédito
- Cartão de débito
- PIX + dinheiro
- Desconto manual
- Comissão de 10%
- Comissão fixa
- Serviço com comissão de cerca de 10%

Acréscimo e promoção:

- Acréscimo inválido, faixa de parcelas invertida e promoção sem nome são ignorados
- Venda com acréscimo diferente da configuração é recusada
- Acréscimo Pix 3%
- Promoção Dia dos Pais 10%
- Promoção 10% somada ao acréscimo Pix 3%
- Cartão em 2x na faixa de 1%

Histórico e caixa:

- Venda concluída aparece no histórico
- Depois de excluir, sai das concluídas e entra em vendas excluídas
- Títulos cancelados, sem conta a pagar nova
- Consolidado do mês soma PIX, dinheiro, crédito e débito
- Venda vinda de orçamento aparece só em Outras entradas, com a descrição Orçamento

## API — lacunas

Script: `scripts/validar-pdv-lacunas-pubdigital.py`. Resultado: passou. Vendas de teste #106 a #110, depois excluídas.

- Comissão lançada (R$ 1,00) mesmo sem gerar o título da venda
- Título já recebido é cancelado no próprio lançamento
- Exclusão grava data e usuário (PubDigital)
- Reativação devolve o título como recebido e reabre a comissão
- Quantidade alterada de 2 para 1
- Forma de pagamento trocada de PIX para dinheiro
- Devolução registrada
- Troca registrada
- Segundo abrir caixa devolve o mesmo caixa; o caixa que já estava aberto foi preservado
- Venda acima do estoque é recusada
- Venda com nota fiscal não pode ser excluída
- Caixa consolidado nos períodos madrugada, tarde e noite

## Navegador

Arquivo: `tests/e2e/pdv.spec.ts`. Organização ativa: pubdgital. Resultado: passou.

- Abrir o PDV, listar o catálogo e finalizar uma venda
- Filtrar vendas no histórico
- Página dedicada do histórico
- Abrir o comprovante
- Atalho F10 de novo cliente
- Tela de configurações (observações, cliente padrão, venda simples, comissão, meio de pagamento, código de estoque, bloqueio de falta, descontos)
- Desconto à vista aplicado na venda
- Promoção e acréscimo na venda
- Caixa consolidado, período da manhã e as seções de pagamento, produtos, serviços e outras entradas
- Todos os campos de configuração refletidos na venda, inclusive a conta financeira
- Venda de produto sem ordem de serviço, e venda de serviço que abre a ordem de serviço (responsável e colaborador obrigatórios)
- Troco, pagamento dividido, duas parcelas no financeiro (uma recebida e uma em aberto) e devolução gerando a conta a pagar "Ajuste da venda"
- Vendas excluídas, com data, usuário e estorno
- Exportação do caixa consolidado
- Períodos madrugada, tarde e noite
- PDV no celular (390 px) e no tablet (768 px)
- Acessibilidade básica da tela do PDV

## O que não foi testado

- Recusa de exclusão, troca e fechamento de caixa para um vendedor que não é administrador. A organização não tem um membro só de caixa.
- Promoção vencida aplicada numa venda. A promoção "dia dos namorados" (validade em 2024) fica cadastrada e não foi escolhida nas vendas desta rodada. Não houve uma venda que tentasse usá-la e comprovasse que o desconto é ignorado.

## Ajuste publicado durante os testes

O valor sugerido ao adicionar uma forma de pagamento passa a incluir o acréscimo daquela forma. Sem isso, R$ 6 em dinheiro mais PIX deixava "Falta R$ 0,12" e o finalizar ficava desligado.
