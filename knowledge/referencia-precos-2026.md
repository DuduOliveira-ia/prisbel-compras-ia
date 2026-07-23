# Referência de Preços 2026 — histórico de compras (v1.0)

Fonte: `docs/PLANILHA COMPRAS 2026.xlsx` (aba ANALÍTICO), enviada pela Daniela em
23/07/2026. É a "Planilha de Compras / NFs" do processo formal: registro real de
tudo que foi comprado no ano.

Destilado em `knowledge/referencia-precos-2026.csv` por `scripts/gerar_referencia_precos.py`:
6.605 compras → **2.968 materiais únicos** com estatística de preço.

## Para que serve (dito pelo Eduardo)

Base de **pré-orçamento / visão macro de preços**: quando ainda não há nada aprovado
mas a alta gestão quer "um cheiro dos valores" para decidir se faz sentido evoluir a
ideia de negócio. NÃO é cotação nem preço de contrato — é referência histórica.

## Estrutura do CSV

`grupo, descricao, unidade, n_compras, preco_min, preco_mediana, preco_max, obras, ref_temporal`

- **preco_mediana** é o número a usar: robusto aos outliers de digitação e de frete
  embutido que existem nos dados (ex.: "AREIA LAVADA" tem max R$2.635 por uma linha
  com frete/lote no valor — a mediana R$135/m³ é a real).
- **n_compras** = confiança: item com n alto tem preço mais confiável.
- 26 grupos (SERVIÇOS, CANTEIRO, ELÉTRICO, HIDRÁULICO, BLOCO, AÇO, CIMENTÍCIOS,
  REVESTIMENTO, PINTURA, AGREGADOS, CONCRETO…), 23 obras.

## Regras de uso pela Bella (quando virar habilidade)

1. Sempre rotular como **estimativa macro baseada em histórico**, com o mês de
   referência e o nº de compras — nunca como cotação fechada.
2. Usar a **mediana**; citar a faixa (min–max) quando o usuário pedir detalhe.
3. Item sem histórico → "não tenho referência para isso" (regra de ouro: não inventar).
4. Preço de HOJE / compra real continua sendo contrato (CONTRATOS_COMPRAS) ou cotação
   (WF5 futuro) — esta tabela é só o "cheiro".

## Decisão de arquitetura pendente (ADR-002)

2.968 linhas (~90k tokens) não cabem economicamente no prompt de toda mensagem.
Opções em aberto (ver conversa 23/07) — provável: habilidade "Pré-Orçamento" separada,
com lookup por correspondência de texto (filtra o CSV antes de mandar ao Gemini) ou
primeiro caso real de RAG semântico. A decidir com o Eduardo.
