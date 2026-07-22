# CHECKPOINT — 21/07/2026 — Bella v1.1 (memória + WhatsApp)

Estado dos agentes do processo de compras Prisbel / Grupo Muniz Rabelo.
Regra da casa: versionamento sempre — nada é sobrescrito.

## Workflows exportados neste checkpoint

| Arquivo | ID no n8n | Estado | O que mudou |
|---|---|---|---|
| WF6 - Bella WhatsApp v1.1.json | ZFNaiej2sEx8QjTa | ATIVO | NOVO nesta rodada. Pedidos por WhatsApp com triagem, sequencial Pedido.Item, consulta de STATUS, **memória de conversa** (aba MEMORIA) e intenção **COMPLEMENTO** (atualiza item pendente in-place, nunca abre pedido novo). Whitelist: Eduardo + Daniela (5531972249393). |
| Router uazapi v1.3.json | 1ne4HxkRBgp8gQXy | ATIVO | Fan-out duplo: Fwd Agente Locações + **Fwd Bella** (paralelo, retry 2x, timeout 15s). |
| WF2 - Recepcao Respostas v1.3 (mudo fora locacao).json | Hldu4XJLXikGK3Io | ATIVO | Silenciado quando a mensagem não é resposta de locação (sem_contexto → vazio; "não entendi" → vazio). Anti-dupla-resposta com a Bella. |
| WF3 - Triagem de Pedidos v1.4.json | aBz2S5IDxRxNmhY6 | ATIVO | Assinatura Bella (sem rodapé n8n), regras calibradas (saco = unidade; nº de requisição ≠ quantidade; ignorar logotipos), leitura multimodal PDF/foto. |
| WF4 - Painel Daniela v1.4.json | 7WbHA7BoeLnrdw1Z | ATIVO | Identidade Prisbel, cotação por categoria com seleção de fornecedores, badge CONTROLADO, planilha nova. |

WF1 Alerta Diário (locações) segue INATIVO — disparo manual/agendável para demo.

## Banco de dados (Google Sheets)

Planilha: `Planilha_Locações_-_Modelo_Saneado_v1_0` (ID `1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8`)
Abas: LEIA-ME, LISTAS, CONTRATOS, LOG, PEDIDOS, REQUISITOS, FORNECEDORES, COTACOES, **MEMORIA** (nova: NUMERO, DATA/HORA, PAPEL, MENSAGEM, PEDIDO).

## Componente Memory (novidade da rodada)

1. Toda interação grava 2 linhas na aba MEMORIA (mensagem do usuário + resposta da Bella) — auditoria de graça.
2. As últimas 8 mensagens do número + os itens PENDENTES do remetente entram no contexto do LLM.
3. Nova intenção COMPLEMENTO: identifica que a mensagem responde a uma pendência e atualiza a linha existente (batchUpdate A:P), inclusive **sem o remetente citar o número do pedido**. Especificações novas (tipo, litragem, CA, tamanho) são anexadas à descrição do item.
4. Pedido completado → e-mail "[Bella] Pedido N completado via WhatsApp" para a Daniela.

## Testes validados hoje

- Pedido 11 via WhatsApp (3 itens, sequencial 11.1–11.3) — ✅
- STATUS "como está o pedido 11?" — ✅ (bug de duplicação ×9 corrigido com executeOnce no Ler PEDIDOS)
- WF2 mudo em mensagens de compras (sem dupla resposta) — ✅
- COMPLEMENTO citando pedido ("pedido 12: 100 litros, 200 unidades") — ✅ linha 64 atualizada
- COMPLEMENTO sem citar pedido ("são 40 pares, tamanho G") — ✅ achou 14.1 pela memória
- Fechamento incremental ("CA 15083") → item COMPLETO + aviso à Daniela — ✅

## Como restaurar

n8n → menu ⋯ → Import from File → selecionar o JSON. As credenciais (Google Sheets, Gmail, Gemini, UAZAPI) são referenciadas por ID e já existem na instância.

## Pendências conhecidas

- Pedidos 11–14 na planilha são de teste — limpar ou usar como demo viva.
- Pedido 12 ficou sem a especificação "100 litros, reforçado" na descrição (complemento anterior ao ajuste de prompt) — completar no painel.
- OAuth Google em modo Testing: reconectar credencial a cada 7 dias até publicar o app.
- Renovação automática do domínio ssysbot.com e do VPS: DESLIGADA (expiram 02/2027) — ativar.
- WF5 (leitura de respostas de fornecedores → aba COTACOES, de-para via IA) — próximo módulo.
- Chip dedicado "Bella": warm-up 1–2 semanas; servidor uazapi atual limita 1 instância.
