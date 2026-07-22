# Importação dos workflows no n8n — v1.0

Agente de Locações (demo) — 2 workflows para importar em n8n.ssysbot.com.

## 1. Importar

Para cada arquivo (`WF1 - Alerta Diario v1.0.json` e `WF2 - Recepcao Respostas v1.0.json`):
menu **⋯** (canto superior direito do editor) → **Import from File** → selecionar o JSON → **Save**.

## 2. Configurar o nó "Config" (nos DOIS workflows)

| Campo | Preencher com |
|---|---|
| `SHEET_ID` | ID da planilha "Locações" no Google Drive (trecho da URL entre `/d/` e `/edit`) |
| `NUMERO_DANIELA` | Número autorizado a comandar o agente, ex.: `5531XXXXXXXXX` (na demo, pode ser o do Eduardo) |
| `UAZAPI_BASE` | URL base da instância uazapi (conferir no painel — ajustar se o endpoint de envio não for `/send/text`) |
| `MODEL_LLM` | Modelo Claude (default: `claude-haiku-4-5-20251001` — barato e suficiente p/ classificação) |

## 3. Credenciais (é isso que o Eduardo entra depois)

| Nó | Credencial |
|---|---|
| Ler CONTRATOS / Ler LOG / Gravar LOG / Atualizar CONTRATOS | **Google Sheets OAuth2** (conta com acesso à planilha) |
| Enviar WhatsApp / Confirmar no WhatsApp | **Header Auth**: nome do header conforme doc uazapi (ex.: `token`), valor = token da instância |
| Chamar LLM (Claude) | **Header Auth**: header `x-api-key`, valor = API key da Anthropic |
| Fallback E-mail (Gmail) | **Gmail OAuth2** |

Nunca colar tokens direto nos nós HTTP — sempre como credencial.

## 4. Ajustes esperados (marcados no código)

1. **WF2 → nó "Whitelist e extração"**: o formato do payload do uazapi varia por versão.
   Enviar uma mensagem de teste, abrir **Executions**, olhar o JSON recebido e ajustar os
   caminhos de `remetente`, `textoMsg` e `fromMe` (o código já tenta os formatos mais comuns).
2. **uazapi → Webhook Global**: apontar para a URL de produção do webhook do WF2
   (`https://n8n.ssysbot.com/webhook/agente-locacoes`), evento de mensagens recebidas.
3. **Endpoint de envio**: se a instância usar outro path que não `/send/text`, corrigir nos dois nós HTTP de envio.
4. **Nó "Atualizar CONTRATOS"**: confirmar no dropdown que a coluna de match é `ID`.

## 5. Regras que os fluxos já implementam

- Idempotência: não alerta o mesmo contrato duas vezes no mesmo dia (consulta a aba LOG).
- Contratos com CADASTRO = "FALTA: ..." não geram alerta de vencimento — entram como pendência de cadastro na mensagem.
- MAPA_ITENS gravado no LOG a cada alerta → é o contexto que o WF2 usa para interpretar "1 devolve, 2 renova".
- Só altera SITUAÇÃO com confiança ALTA do LLM; na dúvida, pede confirmação com opções numeradas.
- Mensagens de números fora da whitelist são ignoradas silenciosamente.
- Falha no envio WhatsApp (3 tentativas) → alerta sai por Gmail (fallback).
- Toda interação gera linhas na aba LOG (auditoria, nada é sobrescrito).

## 6. Ordem de teste (checklist completo no Roteiro Técnico v1.0, seção 6)

1. WF1 manual (**Execute Workflow**) → mensagem chega com itens numerados + pendências de cadastro.
2. WF1 de novo → não duplica (idempotência).
3. Responder "1 devolve, 2 renova" → SITUAÇÃO muda, LOG registra, confirmação ✅ chega.
4. Responder algo ambíguo → nada muda, agente pede confirmação.
5. Ativar os dois workflows (toggle **Active**) só depois dos testes manuais.
