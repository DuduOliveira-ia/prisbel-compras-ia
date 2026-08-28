# Bella — Documento Técnico de Repasse

**Para:** quem assumir o desenvolvimento
**De:** Eduardo Oliveira (SSYS) · v1.0 · 21/08/2026

Este documento existe para você conseguir mexer na Bella **sem quebrá-la** e sem
repetir os erros que já custaram caro aqui. Leia as seções 1 a 4 antes do primeiro
deploy, e a seção 8 (dificuldades) antes de tomar qualquer decisão de arquitetura.

---

## 1. O que é a Bella, em um minuto

Assistente de compras com IA para a **Prisbel Construtora**. O almoxarife ou o
engenheiro pede material conversando (chat, voz, e-mail ou WhatsApp); ela confere
as especificações, cobra o que falta, registra o pedido numa fila, dispara cotação
aos fornecedores certos, lê as respostas em texto livre e monta o comparativo de
preços para a compradora decidir.

**A regra que define o produto:** ela *prepara*, humanos *aprovam*. A Bella nunca
fecha compra, nunca fala com fornecedor sem aprovação, e nunca inventa dado.

---

## 2. Arquitetura — quatro peças

```
  Navegador (chat / painel)
          │  HTTPS
          ▼
  n8n  (VPS Hostinger)  ──► Gemini 2.5 Flash   (raciocínio, sem estado)
   8 workflows              Gmail API          (envio e leitura de e-mail)
          │                 Google Sheets API  (dados)
          ▼
  Planilha Google  ──  todo o estado do sistema
```

**Não existe banco de dados.** A planilha é o banco. Toda leitura é ao vivo, a cada
mensagem — não há cache. Mudou a planilha, mudou o comportamento na resposta seguinte.

**O Gemini não guarda nada.** Todo o conhecimento vai no prompt, montado a cada
requisição (~25 mil caracteres). Isso tem consequências — ver seção 8.4.

---

## 3. Os workflows

Todos no n8n `https://n8n.ssysbot.com`. Os IDs são estáveis.

| WF | ID | Função | Fonte |
|---|---|---|---|
| **WF7 Bella Chat** | `Im4ijv69Fuk0XxKa` | O coração. Serve a página e a API do chat | `scripts/deploy_bella_chat.mjs` |
| **WF3 Triagem** | `aBz2S5IDxRxNmhY6` | Pedido que chega por e-mail (lê foto e PDF) | editado via API |
| **WF5 Cotações** | `exEKLGtwkASI2XzD` | Lê a resposta do fornecedor e lança na planilha | `scripts/deploy_wf5_cotacoes.mjs` |
| **WF4 Painel** | `7WbHA7BoeLnrdw1Z` | Painel de pedidos da compradora | editado via API |
| **WF8 Admin** | `XrpT7yWGIE6tgfvt` | Acessos, cadastros, upload de documento | `scripts/deploy_bella_admin.mjs` |
| **WF6 WhatsApp** | `ZFNaiej2sEx8QjTa` | Pedidos por WhatsApp (uazapi) | editado via API |
| Router uazapi | `1ne4HxkRBgp8gQXy` | Fan-out do webhook do WhatsApp | — |
| WF2 / WF1 Locações | `Hldu4XJLXikGK3Io` / `Ji4IgetwZB8QEntO` | Projeto anterior (locação de equipamento) | — |

### ⚠️ A regra mais importante deste projeto

**O script de deploy é a fonte da verdade, não o editor do n8n.**

Se você editar um workflow pelo editor e depois alguém rodar o script, sua alteração
é apagada sem aviso. Isso já aconteceu aqui: uma correção de dois dias foi perdida
num redeploy de rotina. Para os workflows com script (WF7, WF5, WF8), **sempre** altere
o script e rode o deploy.

---

## 4. Modelo de dados

Planilha `1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8`
(cuidado: o ID tem um **L minúsculo** em `Xnl` — já custou uma hora de depuração).

| Aba | Papel |
|---|---|
| **PEDIDOS** | A fila. 16 colunas, **uma linha por item** (A=nº, H=item, I=qtd, J=unid, K=categoria, L=status, M=pendências, P=item nº) |
| **COTACOES** | Respostas dos fornecedores, uma linha por item cotado |
| **FORNECEDORES** | `CATEGORIA · FORNECEDOR · E-MAIL · OBS` (+ id, tipo, ativo — ver dívida 11.2) |
| **REQUISITOS** | 20 categorias com os campos obrigatórios de cada uma e a flag CONTROLADO |
| **OBRAS / PESSOAS / ACESSOS** | Cadastros. ACESSOS controla login por token com expiração |
| **DOCUMENTOS** | Memoriais e procedimentos; coluna H tem o texto extraído (RAG-lite) |
| **CONVERSAS** | Histórico do chat, uma linha por mensagem |
| **CONTRATOS_COMPRAS** | **Vazia.** É o que destrava a maior funcionalidade pendente (seção 10) |
| **CONFIG** | Parâmetros operacionais (chave/valor) |
| **MATERIAIS** | 26 grupos de compra reais + NBRs extraídas do histórico |

Abas `*_BAK_*` são backups automáticos dos resets de teste.

---

## 5. Ambiente e primeiros passos

```bash
git clone https://github.com/DuduOliveira-ia/prisbel-compras-ia.git
cd prisbel-compras-ia
npm install
```

Crie o `.env` (nunca versionado) com:

```
N8N_BASE_URL=https://n8n.ssysbot.com
N8N_API_KEY=<Settings → n8n API no painel do n8n>
SHEET_ID=1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8
BELLA_CHAT_TOKEN=...
BELLA_ADMIN_TOKEN=...
EMAIL_DANIELA=...
FORN_CONTROLADO=... FORN_COMUM1=... FORN_COMUM2=...
```

**Checklist do primeiro dia:**

1. `node scripts/teste_e2e.mjs` — 26 verificações. Se não der 26/26, pare e entenda antes de mexer.
2. Abra `scripts/deploy_bella_chat.mjs` e leia o prompt (a constante `SYSTEM`). É ali que mora o comportamento.
3. Faça uma alteração mínima no prompt, rode o deploy, veja o efeito no chat. Familiarize-se com o ciclo.
4. Leia a seção 8 deste documento inteira.

---

## 6. O ciclo de desenvolvimento

```bash
node scripts/reset_base_teste.mjs      # zera fila/conversas/cotações (faz backup antes)
# edite scripts/deploy_bella_chat.mjs
node scripts/deploy_bella_chat.mjs     # publica (faz bounce automático)
node scripts/teste_e2e.mjs             # 26 casos, ~3 min
```

**Sempre resete a base antes da bateria.** Alguns casos dependem do estado inicial;
rodar sobre base suja produz falhas falsas (já enganou muito aqui).

Scripts úteis:

| Script | Para quê |
|---|---|
| `responder_cotacoes.mjs --pedido=N` | Simula os fornecedores respondendo, sem abrir e-mail |
| `simula_resposta_fornecedor.mjs` | Injeta uma resposta específica na caixa da Bella |
| `teste_comparativo.mjs` | Verifica a matemática do comparativo |
| `teste_dedupe_cotacao.mjs` | Verifica proposta corrigida do mesmo fornecedor |
| `organiza_fornecedores.mjs` | Recadastra fornecedores derivando da REQUISITOS |
| `set_email_daniela.mjs` | Troca o e-mail da compradora nos 4 workflows |
| `revisao_planilha.mjs` | Dump de todas as abas |

---

## 7. O princípio central: segurança no código, UX no prompt

Esta é a lição mais importante do projeto, e não é negociável.

**O LLM varia.** A mesma pergunta, no mesmo estado, produz respostas diferentes. Regra
escrita no prompt é *tendência*, não garantia. Testamos, corrigimos por prompt, e o
comportamento voltou dias depois com outra roupa.

**Portanto:** tudo que, se falhar, causa dano — envio de e-mail, gravação de pedido,
cálculo de preço, escolha de fornecedor — é decidido por **código determinístico**. O
LLM decide *quando* agir e escreve o texto; o código decide *o quê* e *para quem*.

Travas hoje em produção (todas no Code node "Processar" do WF7):

| Trava | Protege contra |
|---|---|
| **Cotação em 2 etapas** | E-mail sair para fornecedor sem aprovação humana |
| **Roteamento calculado** | Item ir para o fornecedor errado, ou destinatário vazio |
| **Comparativo determinístico** | Soma errada e vencedor invertido (já aconteceu) |
| **Honestidade do registro** | Dizer "pedido registrado" sem gravar (aconteceu 3×) |
| **Anti-duplicata** | Mesmo pedido virar dois números |
| **E-mail sempre da tabela** | Endereço inventado pelo LLM |
| **Dedupe de cotação** | Proposta corrigida somar em vez de substituir |

Ao adicionar funcionalidade, pergunte: *se o LLM errar aqui, qual o prejuízo?* Se for
material, resolva no código.

---

## 8. Dificuldades que enfrentamos e como superamos

Esta seção é o coração do repasse. São armadilhas reais, todas pagas com tempo.

### 8.1 O LLM afirmando o que não fez

**O problema.** A Bella dizia *"Pedido 7 registrado! A Daniela já consegue ver"* e não
gravava nada. O usuário seguia confiante; a compradora não via pedido nenhum. Aconteceu
em três formas diferentes ao longo de duas semanas — cada vez que fechávamos uma frase
no prompt, ela encontrava outra.

**Como superamos.** Paramos de tentar consertar pelo prompt. Hoje o código compara a
*afirmação* com o *fato*: se a resposta afirma registro (em qualquer variação — "registrado",
"a Daniela já consegue ver", "segue para cotação") e não houve gravação, o trecho é removido
e a resposta vira "Confirma que posso registrar assim?".

**A lição.** Verifique a afirmação contra o efeito colateral real, não contra o texto esperado.

### 8.2 Registro parcial gerando pedidos duplicados

**O problema.** Numa apresentação, a Bella registrou o pedido 9 com metade dos itens
enquanto ainda perguntava o resto, e depois registrou o 10 com tudo. Ficaram dois pedidos,
um deles inválido. Aconteceu três vezes na mesma demo.

**Como superamos.** Duas travas: (a) enquanto a resposta ainda pede informação, nenhum
registro acontece; (b) se a mesma conversa já registrou um pedido e os itens novos se
sobrepõem, o sistema **atualiza** o pedido existente em vez de criar outro.

### 8.3 A cedilha que roteava tudo errado

**O problema.** O chat gravava a categoria como `ACO` e a tabela de fornecedores tinha
`AÇO`. A comparação era por igualdade exata, então **nenhum** pedido de material controlado
achava seu fornecedor — tudo caía no fornecedor GERAL, silenciosamente, por semanas.

**Como superamos.** Comparação normalizando acento e caixa, nos dois lados. O mesmo bug
reapareceu depois no **nome do fornecedor** (o LLM escreve "Aco Forte") — mesma correção.

**A lição.** Em português, nunca compare strings de domínio sem normalizar acento.

### 8.4 Prompt maior degradou comportamento que já funcionava

**O problema.** Injetei um bloco de ~1.200 caracteres no prompt para ajudar o LLM a
escolher fornecedor. O prompt foi a 26 mil caracteres e a Bella **perdeu a memória entre
turnos**: o usuário dizia "50 sacos de cimento", ela respondia depois "falta a quantidade".
A bateria caiu de 26/26 para 17/26, três rodadas seguidas.

**Como superamos.** Removi o bloco. O roteamento já estava garantido no código — a
instrução no prompt era redundante. Voltou a 26/26 imediatamente.

**A lição.** Contexto adicional tem custo. Mais informação no prompt pode degradar um
comportamento sem nenhuma relação com o que você acrescentou. Meça antes e depois.

### 8.5 Condição de corrida invisível na planilha

**O problema.** Com três fornecedores respondendo na mesma execução, o WF5 fazia três
chamadas `append` quase simultâneas. Duas resolviam a **mesma linha de destino** e uma
sobrescrevia a outra. A proposta era processada corretamente, aparecia no log, e **sumia
da planilha**. A execução constava como sucesso.

**Como superamos.** Um nó agrega as linhas de todos os fornecedores em **uma única**
gravação. O aviso à compradora foi para um ramo paralelo, para continuar sendo um e-mail
por fornecedor.

**Como diagnosticamos** (útil para você): o campo `tableRange` da resposta do append
mostrava `A1:N1`, `A1:N2` e `A1:N2` — duas gravações enxergando o mesmo estado.

### 8.6 Perda silenciosa de e-mail no Gmail Trigger

**O problema.** O nó `Preparar` do WF5 fazia `const g = $json`, que pega **só o primeiro**
item quando o trigger entrega vários e-mails numa execução. Os demais eram descartados —
e, pior, ficavam marcados como não lidos para sempre, porque a linha de base do poller já
tinha passado. Perda **permanente e silenciosa**, no cenário mais normal possível: dois
fornecedores respondendo a mesma cotação.

**Como superamos.** `Preparar` itera `$input.all()`; os nós seguintes rodam em
`runOnceForEachItem` e usam `$('Nó').item` para parear.

### 8.7 As pegadinhas do n8n que mais custaram

- **Bounce obrigatório.** Alterou workflow ativo? Desativar e reativar, senão o webhook
  serve a versão velha. Os scripts de deploy já fazem.
- **Bounce zera o poller do Gmail Trigger.** E-mails anteriores à reativação nunca
  disparam. Se estiver testando fluxo de e-mail, reenvie a mensagem depois do bounce.
- **Escape em template literal.** O código dos Code nodes é gerado por template string.
  `\n` dentro dele vira quebra de linha real e **quebra o literal**; `\d` vira `d` e
  destrói a regex. Use `\\n` e `\\d`. Isso derrubou o chat e o painel em produção três
  vezes. **Sempre valide a sintaxe do código gerado antes de publicar:**
  `new Function(jsCode)` num script de checagem.
- **Nó webhook criado via API precisa de `webhookId` (uuid).** Sem ele a rota não
  registra — falha silenciosa, 404.
- **`values:batchUpdateByDataFilter` falha em silêncio.** Sem erro e sem escrever. Use
  `values:batchUpdate` com `range` A1, e confira `totalUpdatedCells` na resposta.
- **`batchGetByDataFilter` não garante a ordem** dos ranges na resposta. Leia um por vez
  ou case pelo `dataFilter` retornado.
- **Cota do Sheets é por minuto.** Rajada de leituras derruba nós com "too many requests".
  WF3 e WF5 têm `retryOnFail` por isso.
- **CSP do n8n serve a página em sandbox sem `allow-same-origin`.** `localStorage` lança
  SecurityError. Estado do front tem que ir para o servidor.
- **Arquivos do repo são CRLF.** Scripts de patch precisam normalizar antes de casar
  trechos multilinha, senão o replace falha em silêncio.

### 8.8 OAuth do Google expirando a cada 7 dias

O app OAuth está em modo *Testing*, então o refresh token morre semanalmente e a Bella
perde acesso à planilha e ao Gmail. **Publicar o app resolve** e está no backlog como
prioridade A. Enquanto isso: reconectar a credencial Google no n8n, escolhendo a conta
`ssysbot@gmail.com`. O farol do Admin mostra o estado (`google_ok`).

### 8.9 A bateria de testes oscila

Rodadas seguidas dão 25 ou 26 de 26. A variação vem do LLM e do estado da base. **Sempre
resete antes.** Se cair para menos de 24, é bug de verdade — investigue, não repita o teste
até passar. Foi assim que achamos 8.1 e 8.4.

---

## 9. Como testar de ponta a ponta

```bash
node scripts/reset_base_teste.mjs
```

1. Abra o chat do almoxarife e peça material misto:
   *"100 sacos de cimento CP II-32, 12 m³ de areia lavada média e 4 rolos de lona preta"*
2. Ela pergunta só a micragem da lona. Responda "200 micras" → pedido registrado.
3. No chat da compradora: *"Envia a cotação do pedido 1 para os fornecedores de cada categoria"* → ela propõe → *"Pode enviar"*.
4. `node scripts/responder_cotacoes.mjs --pedido=1` — os fornecedores respondem.
5. Na compradora: *"Como estão as cotações do pedido 1?"*

**O que validar:** cimento e areia vão só para o fornecedor de material controlado; a lona
vai para os dois concorrentes; e o comparativo aponta o menor **total** considerando frete
(o "mais barato" com frete por fora perde).

---

## 10. O que falta — em ordem de valor

Detalhe completo em `docs/BACKLOG.md` (numerado ate 40, 37 abertos) e `docs/PLANO-CONTRATOS-AF.md`.

**1. Contrato e AF.** Material controlado (cimento, areia, brita, aço) tem contrato de
longa duração; o pedido desses itens **não deveria ir a cotação** — deveria virar
Autorização de Fornecimento direto. Hoje a Bella manda tudo para cotação. É a maior
divergência entre o sistema e o processo real. Exige `quantidade_contratada` e `saldo`
na aba CONTRATOS_COMPRAS, e definir quem mantém essa conta.

**2. Particionar o pedido.** O fluxo alvo, descrito pelo dono do projeto: *"desses 10
itens, cinco já têm preço, posso liberar? Os outros cinco, posso cotar?"* — duas
autorizações distintas, não uma.

**3. Consolidação por obra.** A compradora junta os pedidos de todos os requisitantes da
mesma obra antes de cotar. Hoje cada pedido é tratado isoladamente, o que fragmenta a
compra e ignora o faturamento mínimo do fornecedor.

**4. Identidade no painel.** O painel usa um token fixo, sem autor. Virou questão de
**compliance**: a auditoria externa passou a olhar log e rastreabilidade, e aprovação sem
autor não se sustenta.

---

## 11. Dívidas técnicas conhecidas

**11.1 Lógica de cotação duplicada.** Existe no WF4 (painel) e no WF7 (chat). Toda mudança
precisa ser feita duas vezes — e já divergiram sem ninguém notar. Extrair para um
sub-workflow.

**11.2 Colunas fantasma em FORNECEDORES.** A aba tem `fornecedor_id`, `tipo` e `ativo`,
mas os workflows leem só `A:D`. Marcar um fornecedor como `ativo = FALSE` **não tem efeito
nenhum**. Armadilha esperando acontecer.

**11.3 Limite de 60 linhas em FORNECEDORES.** São 24 hoje. O cadastro real tem ~2.000 —
o range vai truncar em silêncio.

**11.4 A bateria cobre só o chat.** O painel não tem teste automatizado. Foi por isso que
o formato de assunto do painel divergiu do que o WF5 esperava, quebrando o retorno das
cotações sem aviso.

**11.5 A planilha como banco.** Funciona bem no piloto e é auditável por qualquer pessoa
do setor, mas tem limite de linhas, cota por minuto e nenhuma transação. O schema já está
congelado para migrar 1:1 (ver `docs/Esquema de Dados Bella v1.1.md`).

---

## 12. Acessos e segredos

**Nada de segredo entra no Git.** O `.env` e a pasta `SupaBase/` estão no `.gitignore`.

Você vai precisar de: conta no n8n (para gerar a API key), acesso de edição à planilha,
e a credencial Google `ssysbot@gmail.com` conectada no n8n.

Os tokens de acesso das pessoas (chat, painel, admin) ficam na aba **ACESSOS**, com
expiração. Gere novos pelo módulo Admin, nunca reutilize.

**Propriedade intelectual:** por contrato (cláusula 5.2), o motor e o código são da SSYS.
O cliente tem direito de uso restrito. Isso importa em qualquer conversa sobre entrega
de código.

---

## 13. Como manter a Bella boa

Três hábitos que fizeram diferença:

**Rode a bateria antes e depois de qualquer mudança.** Ela pega regressão em lugar que
você não tocou — e no caso 8.4 foi ela que denunciou uma degradação sutil de memória.

**Anote a frase exata quando algo sair errado.** Print sozinho esconde o contexto que
causou o problema. Os bugs mais graves aqui foram achados a partir da frase literal que
a Bella respondeu.

**Desconfie de sucesso silencioso.** Os dois piores bugs deste projeto (8.1 e 8.5) tinham
execução marcada como sucesso e log limpo. Verifique o efeito, não o status.
