# Esquema de Dados da Bella — v1.0 (CONTRATO DE SCHEMA)

23/07/2026 · Vale para Google Sheets HOJE e Supabase/Postgres DEPOIS — mesmos nomes,
mesmos campos. Renomear qualquer campo exige nova versão deste documento.
Regras: `obra_id` em tudo que é relacionável · IDs opacos e estáveis · datas ISO
(AAAA-MM-DD) · decimais com ponto · sem fórmulas nas colunas de dados.

## Abas NOVAS (camada de conhecimento)

### OBRAS
| Campo | Tipo | Exemplo / Observação |
|---|---|---|
| obra_id | texto (PK) | OB-001 |
| nome | texto | Paradiso |
| cidade | texto | Nova Lima |
| endereco | texto | |
| status | ATIVA / CONCLUIDA / PARADA | |
| recursos | texto (lista `;`) | grua;bomba — o "a obra tem grua" do Dono |
| observacoes | texto | |

### PESSOAS
| Campo | Tipo | Exemplo |
|---|---|---|
| pessoa_id | texto (PK) | PS-001 |
| nome | texto | Dú |
| papel | ALMOXARIFE / REQUISITANTE / ENGENHEIRO / TEC_SEGURANCA / COMPRADORA | |
| obra_id | FK → OBRAS | OB-001 (vazio = todas, ex.: Daniela) |
| telefone_whatsapp | texto | 5531999990000 (formato uazapi, sem +) |
| email | texto | |
| ativo | TRUE/FALSE | controla whitelist da Bella |

### CONTRATOS  ← o coração do "contratado → AF direta"
| Campo | Tipo | Exemplo |
|---|---|---|
| contrato_id | texto (PK) | CT-001 |
| material | texto | Cimento CP II-32 |
| categoria_r09 | nº 1-42 (FK → knowledge/tabela R.09) | 14 |
| fornecedor_id | FK → FORNECEDORES | FOR-001 |
| preco_unitario | decimal | 25.00 |
| unidade | texto | saco 50kg |
| vigencia_inicio / vigencia_fim | data ISO | 2026-01-01 / vazio = indeterminado |
| pedido_minimo | texto | 20 t (CSN não fatura menos) |
| frete | CIF / FOB / INCLUSO / A_PARTE | |
| condicoes | texto | permuta 70/30; reajuste por aditivo |
| obra_id | FK, vazio = todas | |
| status | VIGENTE / VENCIDO / SUSPENSO | |
| fonte | texto | quem informou (Luís, Daniela, aditivo nº…) |
| atualizado_em | data ISO | |

### FATOS  ← aprendizado auditável (nunca inventado)
| Campo | Tipo | Exemplo |
|---|---|---|
| fato_id | texto (PK) | FT-001 |
| obra_id | FK | OB-001 |
| fato | texto | Vasos sanitários da obra são brancos (memorial) |
| origem | texto | WhatsApp Daniela 23/07/2026 |
| confirmado_por | texto | Daniela — SÓ vira verdade após confirmação humana |
| confirmado_em | data ISO | |
| ativo | TRUE/FALSE | desativar em vez de apagar |

### DOCUMENTOS  ← índice da camada 3 (RAG-lite)
| Campo | Tipo | Exemplo |
|---|---|---|
| doc_id | texto (PK) | DC-001 |
| obra_id | FK (vazio = geral) | OB-001 |
| tipo | MEMORIAL / QUADRO_MATERIAIS / PROJETO / PROCEDIMENTO | |
| titulo | texto | Memorial Descritivo Paradiso rev.3 |
| link | URL (Drive) | fonte que o bella-brain injeta no contexto |
| versao | texto | rev.3 |
| atualizado_em | data ISO | |

## Abas EXISTENTES (não mexer sem plano de migração)

PEDIDOS, REQUISITOS, FORNECEDORES, COTACOES, MEMORIA continuam como estão — os
workflows vivos dependem delas. Reconciliações futuras (fase 2):
- FORNECEDORES ganha coluna `fornecedor_id` (FOR-001…) para os FKs de CONTRATOS.
- REQUISITOS pode ser enriquecida com as 42 categorias da R.09 (hoje em
  `knowledge/tabela-compras-r09-materiais.md`, que já serve de fonte no prompt).

## Migração futura ao Supabase (quando o Eduardo liberar)

1 aba = 1 tabela, mesmo nome em minúsculas (`OBRAS` → `obras`). Export CSV → import.
FKs e constraints entram aí de graça porque os IDs já existem e são consistentes.
