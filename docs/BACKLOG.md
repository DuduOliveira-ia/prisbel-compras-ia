# Backlog — Bella Compras Prisbel (v1.0, 10/08/2026)

Lista viva de melhorias e dívidas técnicas. Prioridade: A = antes de operar de verdade · B = primeiras semanas de operação · C = evolução. Itens novos (pedidos do Luís, feedback da Daniela) entram no fim com data.

| # | Prio | Item | Detalhe |
|---|---|---|---|
| 1 | A | **Painel (WF4) com token único, sem identidade** | O link do painel usa um token fixo hardcoded; qualquer aprovação de envio feita lá não tem autor registrado. Migrar para a aba ACESSOS (mesmo esquema do chat, com expiração) e registrar QUEM aprovou cada cotação — auditoria de compras. |
| 2 | A | **Motor único de cotação** | Formato de assunto e efeitos (EM COTAÇÃO) foram padronizados em 10/08, mas a lógica de montar/validar/enviar cotação ainda vive duplicada em WF4 (painel) e WF7 (chat). Extrair para um sub-workflow chamado pelos dois (e pelo futuro modo automático). Enquanto houver duplicação, toda mudança tem que ser feita 2×. |
| 3 | A | **E-mail corporativo da Bella** (`bella.ia@prisbel...`) | Trocar a conta ssysbot@gmail.com. Junto: publicar o app OAuth (acaba a reconexão semanal) e display name "Bella — Compras Prisbel". Afeta credenciais Gmail/Sheets no n8n (WF3, WF5, WF7, WF8, WF4). |
| 4 | A | **E-mail oficial da Daniela** | Trocar o dublê `oliveirae.ti@gmail.com` por `compras@grupomunizrabelo.com.br` nos avisos (WF3, WF5) e na cópia da cobrança (WF7, const EMAIL_DANIELA). Mover para a aba CONFIG para trocar sem redeploy. |
| 5 | B | **Complemento de pendência por e-mail** | Hoje a resposta do requisitante à cobrança cai no WF3 como e-mail comum (vira pedido novo ou "não classificado"). Fechar o ciclo: resposta atualiza o pedido existente (como o COMPLEMENTO do WhatsApp faz). Incluir complemento cross-canal (pedido por e-mail completado por WhatsApp/chat). |
| 6 | B | **Modo automático da comunicação interna** | Aba CONFIG criada com `cobranca_interna_automatica = NAO`. Implementar o mecanismo no WF3: com SIM, a cobrança de pendência sai sozinha para o requisitante (com cópia à Daniela) em vez de ficar como rascunho. Externo (fornecedor) fica SEMPRE manual — decisão de política, não vira switch. |
| 7 | B | **Painel sem teste automatizado** | A bateria E2E (26 casos) cobre só o chat. Foi assim que o formato de assunto do painel divergiu sem ninguém notar. Cobrir as APIs do WF4 (listar, salvar, cotação) na bateria. |
| 8 | B | **Cadastro da obra VINHÁTICO** | Pedido nº 1 do teste aponta para obra que não existe em OBRAS. Cadastrar com nome oficial (ou mapear para obra existente). A Bella deveria sinalizar quando um pedido chega com obra desconhecida. |
| 9 | B | **Tipo de Entrada: compra × consignação** | Pedido do Eduardo (06/08, ficou pendente): registrar se a entrada é compra ou consignação. Definir onde vive (campo no pedido? na entrada de material?) antes de implementar. |
| 10 | C | **Mensagem amigável no painel com token errado** | Hoje o painel com token inválido responde de forma seca; alinhar com a página "Link inválido ou expirado" do chat. |
| 11 | C | **Migração planilha → Supabase** | Schema já congelado 1:1 (docs/Esquema de Dados v1.1). Só após Eduardo liberar a questão da conta (CULTOPPS). |
| 12 | C | **Chip WhatsApp dedicado "Bella"** | Warm-up 1–2 semanas; servidor uazapi atual limita 1 instância. |
| 13 | C | **Backup automático da planilha** | Único ponto sem versionamento automático (backups manuais *_BAK_*). Automatizar cópia periódica via Drive API. |

## Feito recentemente (para contexto)
- 10/08: cobrança de pendência por e-mail via chat (2 etapas, destinatário da tabela, cópia à Daniela) · corpo de e-mail em texto puro (sanitizador) · retryOnFail nos pollers WF3/WF5 (cota do Sheets) · reset da base de teste com backup *_BAK_1008 · regra 7b (resposta clara sobre o que não faz).
