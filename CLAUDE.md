# Prisbel Compras IA — contexto do projeto

Assistente de compras com IA ("**Bella**") para a Prisbel Construtora / Grupo Muniz Rabelo, apoiando a compradora **Daniela**. Recebe pedidos por e-mail e WhatsApp, faz triagem com LLM, controla pendências, alimenta um painel web e dispara cotações personalizadas por fornecedor. Em piloto real (Daniela encaminhando requisições verdadeiras).

Mentor/dono do projeto: Eduardo (ssysbot@gmail.com = conta do agente; oliveirae.ti@gmail.com = faz o papel do e-mail da Daniela nos testes; corporativo real: compras@grupomunizrabelo.com.br).

## Regras da casa (NUNCA violar)

1. **Versionamento sempre** — nunca sobrescrever documento ou export; criar v1.1, v1.2…
2. **A IA nunca inventa dados** — o que ela não entende, ela pergunta. Sem resposta = "Não encontrei".
3. Toda comunicação assinada por **Bella** ("Bella — Assistente de Compras | Prisbel Construtora"); `options.appendAttribution:false` em TODO nó Gmail (remove rodapé n8n).
4. Não burocratizar fornecedores (sem formulários/mini-tabelas; a IA lê a resposta livre deles — WF5 futuro).
5. Honestidade: apontar erros e riscos diretamente; nada de bajulação.

## Infraestrutura

| Peça | Valor |
|---|---|
| n8n self-hosted | https://n8n.ssysbot.com (login ssysbot; VPS Hostinger KVM4, EasyPanel, Ubuntu 24.04, IP 72.61.59.127) |
| Banco de dados | Google Sheet `1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8` ("Planilha_Locações_-_Modelo_Saneado_v1_0") — CUIDADO: o ID tem "l" minúsculo em `Xnl` (erro clássico de transcrição) |
| WhatsApp | uazapi, servidor ssysbot `https://ssysbot.uazapi.com`, instância "Maria" (+55 31 97345-2353); webhook global → `https://n8n.ssysbot.com/webhook/router-uazapi`; header de auth: `token` = token DA INSTÂNCIA (não o admin) |
| LLM | Gemini `gemini-2.5-flash`, header `x-goog-api-key`; SEMPRE `thinkingConfig:{thinkingBudget:0}` + `responseMimeType:'application/json'`, temperature 0 (tokens de thinking consomem maxOutputTokens!) |
| OAuth Google | projeto PRESTAI `prestai-490121`, cliente `n8n-agente-locacoes`; app em modo Testing → **refresh token expira a cada 7 dias** — reconectar a credencial Google no n8n semanalmente até publicar o app |
| Painel | https://n8n.ssysbot.com/webhook/painel-compras?t=pb-dnl-4X9k2026 (token hardcoded nos Code nodes do WF4) |

Credenciais no n8n (referenciadas por id nos exports; os segredos ficam SÓ no n8n):
Google Sheets `UtfOFU26GNbDmApU` · Gmail ssysbot `WhxkPdGziEvCRIqD` · Gemini `MgtrdiyIibEc7OYw` (httpHeaderAuth) · UAZAPI `HWdoHX7ad4qoPABV` (httpHeaderAuth).

## Workflows (IDs vivos no n8n)

| Workflow | ID | Estado | Função |
|---|---|---|---|
| WF3 Triagem de Pedidos | `aBz2S5IDxRxNmhY6` | ATIVO | Gmail (assunto com "Prisbel", 1/min) → triagem LLM multimodal (lê PDF/foto anexos) → PEDIDOS + rascunhos + aviso à Daniela |
| WF6 Bella WhatsApp | `ZFNaiej2sEx8QjTa` | ATIVO | Pedido / COMPLEMENTO (memória) / STATUS / OUTRO; whitelist: 553192650324, 5531972249393 (Daniela) |
| WF4 Painel Daniela | `7WbHA7BoeLnrdw1Z` | ATIVO | Serve SPA + APIs listar/salvar (com revalidação LLM)/append/cotação (e-mail por fornecedor, placeholder {FORNECEDOR}) |
| Router uazapi | `1ne4HxkRBgp8gQXy` | ATIVO | Fan-out do webhook global → Locações + Bella (paralelo) |
| WF2 Recepção Locações | `Hldu4XJLXikGK3Io` | ATIVO | Devolve/renova equipamentos; MUDO fora desse contexto (anti-dupla-resposta com WF6) |
| WF1 Alerta Diário | `Ji4IgetwZB8QEntO` | INATIVO | Alertas de locação; disparo manual em demos |
| WF7 Bella Chat | `Im4ijv69Fuk0XxKa` | ATIVO | Chat web AO VIVO: GET `/webhook/bella-chat?t=<BELLA_CHAT_TOKEN>` (página, fonte `painel/bella-chat-v0.8.html`) + POST `/webhook/bella-chat-api` (abas OBRAS/PESSOAS/CONTRATOS_COMPRAS/FATOS/PEDIDOS → Gemini multimodal, transcreve áudio; histórico de conversas na aba CONVERSAS injetado na página via `__BELLA_CONVS__`; HABILIDADE DE AÇÃO: cotação por e-mail em 2 etapas — propõe → usuário confirma → Gmail p/ fornecedores da aba FORNECEDORES, e-mail sempre da tabela, nunca do LLM). Deploy: `node scripts/deploy_bella_chat.mjs` (bounce automático; token no `.env`). NUNCA editar no editor do n8n — o script é a fonte. Bateria de regressão: `node scripts/teste_e2e.mjs` (23 casos; registra 1 pedido real de teste por rodada). AÇÃO registrar_pedido: chat completo → grava na aba PEDIDOS automaticamente (nº sequencial). |
| WF8 Bella Admin | `XrpT7yWGIE6tgfvt` | ATIVO | Módulo admin: GET `/webhook/bella-admin?t=<BELLA_ADMIN_TOKEN>` (painel, fonte `painel/bella-admin-v0.1.html`) + POST `/webhook/bella-admin-api` (farol, acessos c/ expiração, cadastros das abas, upload doc → Gemini extrai → DOCUMENTOS). Deploy: `node scripts/deploy_bella_admin.mjs`. Chat (WF7) valida tokens de usuário na aba ACESSOS e injeta DOCUMENTOS da obra no contexto. |
| WF5 Leitura de Cotações | `exEKLGtwkASI2XzD` | ATIVO | Gmail (`subject:Cotacao is:unread`, 1/min) → identifica fornecedor (FORNECEDORES) → de-para item a item c/ PEDIDOS via Gemini (e-mail LIVRE) → aba COTACOES → aviso à Daniela → marca lido. Deploy: `node scripts/deploy_wf5_cotacoes.mjs`. ATENÇÃO: filtro do WF3 ganhou `-subject:Cotacao` p/ não roubar as respostas. |

Abas da planilha: PEDIDOS (16 col, A=Nº PEDIDO … L=STATUS, M=PENDÊNCIAS, P=ITEM Nº), REQUISITOS (E=CONTROLADO), FORNECEDORES, COTACOES (p/ WF5), MEMORIA (NUMERO, DATA/HORA, PAPEL, MENSAGEM, PEDIDO), CONTRATOS/LOG/LISTAS (locações). Backups de 22/07 nas abas `*_BAK_2207`.
Abas de conhecimento (22/07, schema em `docs/Esquema de Dados Bella v1.1.md` — CONTRATO congelado, migrará 1:1 p/ Supabase): OBRAS, PESSOAS, CONTRATOS_COMPRAS (nome com sufixo pois CONTRATOS é de locações!), FATOS, DOCUMENTOS (col H=conteudo, texto extraído p/ RAG-lite), ACESSOS (tokens de usuário c/ expiração), CONVERSAS (histórico do chat: 1 linha por mensagem — conversa_id, token, titulo, ts, obra, de, texto). Arquitetura: `docs/ADR-001 … v1.1.md` (3 camadas: prompt / tabelas / doc-no-contexto; RAG vetorial adiado).

## Como operar o n8n a partir do Claude Code

Criar uma API key no n8n (Settings → n8n API) e guardar em `.env` (`N8N_API_KEY`). Endpoints públicos:
`GET/PUT https://n8n.ssysbot.com/api/v1/workflows/:id` com header `X-N8N-API-KEY`.

**Pegadinhas operacionais (aprendidas a caro custo):**

- Alterou workflow ATIVO? **Bounce obrigatório**: desativar → reativar, senão o webhook/poller roda a versão velha.
- Bounce em workflow com Gmail Trigger **zera a linha de base do poller** — e-mails anteriores à reativação nunca disparam; reenviar.
- Nó webhook criado via API **precisa de `webhookId`** (uuid) — sem ele a rota não registra (falha silenciosa, 404/500).
- Workflow **arquivado** com active=true não registra webhooks — desarquivar antes.
- Nós Google Sheets/HTTP executam **uma vez POR item de entrada** — usar `executeOnce:true` quando deve rodar só uma vez (bug clássico: fila lida 9× = 558 linhas).
- `alwaysOutputData:true` em leituras que podem vir vazias, senão a cadeia morre silenciosamente.
- Strings de prompt nos Code nodes são **double-quoted**: ao editar via API, jamais inserir `"` sem escape (já quebrou produção no dia da apresentação — usar apenas aspas simples dentro dos prompts).
- **Página servida por webhook n8n roda em `sandbox` SEM `allow-same-origin`** (CSP fixo do n8n, não dá para sobrescrever pelo respondToWebhook): `localStorage`/`sessionStorage` lançam SecurityError. Estado que precisa persistir tem de ir para o servidor (ex.: aba CONVERSAS, injetada na página pelo Code node).
- Arquivos do repo estao em CRLF: script de patch deve normalizar as quebras de linha (CRLF para LF) antes de casar trechos multilinha, senao o replace falha silenciosamente.
- Payload uazapi: remetente real em `message.sender_pn`/`chatid` (o `sender` é um `@lid`); ignorar `wasSentByApi:true` (anti-loop).
- Set node descarta o input — para ler o webhook depois dele: `$('Nome do Webhook').first().json`.

## Calibrações de domínio (construção civil) já embutidas nos prompts

- "saco" é unidade padrão de cimento/argamassa/gesso/cal; latas, rolos, pares, barras, kg, m² etc. são unidades válidas implícitas.
- CP2/CP II-32… (cimento), AC1/AC2/AC3 (argamassa colante), CA-50/CA-60 (vergalhão) JÁ SÃO a classe — não gerar pendência.
- Tijolo/bloco "de vedação" não exige resistência MPa (só estruturais).
- Número junto de PEDIDO/REQUISIÇÃO/RM no assunto = nº do documento, nunca quantidade.
- Ignorar logotipos de assinatura em anexos; urgência com justificativa implícita ("obra parada") vale como motivo.
- Descrição do item preserva TODAS as especificações mencionadas.

## Estrutura deste repositório

```
workflows/   exports n8n (importar: menu ⋯ → Import from File; credenciais casam por id)
painel/      fonte da SPA (o servido de verdade vive no nó "Servir página" do WF4)
docs/        blueprint-checkpoint, roteiro de demo, leia-me de importação
scripts/     geradores de documentos (node, lib docx)
```

**Fonte da verdade é o servidor n8n.** Estes exports foram reconstruídos em 22/07/2026 aplicando os diffs do dia sobre o checkpoint de 21/07 — ao iniciar trabalho, faça um export fresco via API e comite antes de mexer.

## Roadmap (ordem sugerida)

1. ~~WF5 — Leitura de respostas de fornecedores~~ ✅ FEITO 24/07 (comparativo é conversacional no chat, regra 11).
2. Memória/COMPLEMENTO também no canal e-mail (hoje só WhatsApp) — inclusive complemento cross-canal (pedido por e-mail completado por WhatsApp; hoje o filtro de pendências é por remetente do mesmo canal).
3. Publicar o app OAuth (fim da reconexão semanal); conta Google corporativa própria da Bella.
4. Chip dedicado "Bella" (warm-up 1–2 semanas; servidor uazapi atual limita 1 instância).
5. Migração planilha → banco de dados; integração ERP (ver blueprint).
6. Mensagem de erro amigável no painel quando o token da URL está errado.

## Tarefas administrativas pendentes (humano)

- Ativar renovação automática do domínio ssysbot.com e do VPS (expiram 02/2027 — HOJE está desligada).
- Gmail display name → "Bella — Compras Prisbel".
- Backup periódico da planilha (Arquivo → Fazer uma cópia) — único ponto sem versionamento automático.
- Falso positivo do Google Safe Browsing em n8n.ssysbot.com: revisão já solicitada; usuários precisam clicar "acessar mesmo assim" até resolver.
