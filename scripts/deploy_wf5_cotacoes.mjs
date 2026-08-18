// Publica/atualiza o WF5 - Leitura de Cotações:
// Gmail (subject:Cotacao, 1/min) → identifica fornecedor (aba FORNECEDORES)
// → de-para item a item com o PEDIDO via Gemini (e-mail LIVRE, sem formulário)
// → grava na aba COTACOES → avisa a Daniela → marca como lido.
// Uso: node scripts/deploy_wf5_cotacoes.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const { N8N_API_KEY, N8N_BASE_URL, SHEET_ID } = env;
// fonte única no .env — troque com scripts/set_email_daniela.mjs (atualiza WF3/WF5/WF6/WF7)
const EMAIL_DANIELA = env.EMAIL_DANIELA || 'oliveirae.ti@gmail.com';

const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

/* ---------- Preparar: extrai dados do e-mail ---------- */
const jsPreparar =
  // #14: o Gmail Trigger entrega N e-mails em UMA execucao — processar todos
  `return $input.all().map(function (item) {\n` +
  `  const g = item.json;\n` +
  `  const texto = String(g.text || g.textPlain || g.snippet || '').slice(0, 15000);\n` +
  `  const assunto = String(g.subject || g.Subject || '');\n` +
  `  let remetente = '';\n` +
  `  const f = g.from;\n` +
  `  if (typeof f === 'string') { const m = f.match(/<([^>]+)>/); remetente = m ? m[1] : f; }\n` +
  `  else if (f && f.value && f.value[0]) remetente = f.value[0].address || '';\n` +
  `  else if (f && f.text) { const m = String(f.text).match(/<([^>]+)>/); remetente = m ? m[1] : String(f.text); }\n` +
  `  remetente = remetente.trim().toLowerCase();\n` +
  `  const mp = assunto.match(/pedido\\s*(?:n\\S*\\s*)?(\\d+)/i);\n` +
  `  const pedido = mp ? mp[1] : '';\n` +
  `  return { json: { texto, assunto, remetente, pedido, email_id: g.id || '' } };\n` +
  `});\n`;

/* ---------- Montar prompt de extração ---------- */
const jsMontar =
  `const prep = $('Preparar').item.json;\n` +
  `const vr = ($json.valueRanges || []);\n` +
  `const forn = ((vr[0] && vr[0].values) || []).slice(1);\n` +
  `const rowF = forn.find(r => String(r[2] || '').trim().toLowerCase() === prep.remetente);\n` +
  `const fornecedor = rowF ? String(rowF[1]).trim() : ('(nao cadastrado) ' + prep.remetente);\n` +
  `const ped = ((vr[1] && vr[1].values) || []).slice(1)\n` +
  `  .filter(r => String(r[0]) === String(prep.pedido))\n` +
  `  .map(r => 'item ' + (r[15] || '?') + ': ' + (r[7] || '') + ' — ' + (r[8] || '') + ' ' + (r[9] || ''));\n` +
  `const prompt = 'Voce le respostas de cotacao de fornecedores da construtora Prisbel. ' +\n` +
  `  'O fornecedor respondeu em TEXTO LIVRE. Faca o de-para com os itens do pedido e extraia os precos.\\n' +\n` +
  `  'REGRAS: NUNCA invente valores; o que nao estiver claro no e-mail fica null. Precos como numero (ponto decimal, sem R$). ' +\n` +
  `  'PRAZO e FRETE: quase sempre vem UMA VEZ para o e-mail todo (ex.: frete incluso, frete R$ 250 por entrega, entrega em 3 dias uteis). ' +\n` +
  `  'Nesse caso REPITA o mesmo texto em prazo e frete de TODOS os itens — nao deixe null e nao jogue no campo de condicoes. ' +\n` +
  `  'prazo, frete, obs e condicoes_gerais sao STRINGS simples, nunca objeto nem lista. ' +\n` +
  `  'Se o fornecedor citar item que nao casa com nenhum do pedido, use item_no 0 e descreva em obs.\\n\\n' +\n` +
  `  'ITENS DO PEDIDO ' + prep.pedido + ':\\n' + (ped.join('\\n') || '(pedido nao encontrado)') +\n` +
  `  '\\n\\nE-MAIL DO FORNECEDOR (' + fornecedor + '):\\nAssunto: ' + prep.assunto + '\\n' + prep.texto +\n` +
  `  '\\n\\nResponda SOMENTE com JSON valido: {\\"itens\\":[{\\"item_no\\":1,\\"descricao\\":\\"...\\",\\"preco_unit\\":9.99,\\"preco_total\\":null,\\"prazo\\":\\"...\\",\\"frete\\":\\"...\\",\\"obs\\":\\"...\\"}],\\"condicoes_gerais\\":\\"...\\"}';\n` +
  `return { json: { fornecedor, pedido: prep.pedido, remetente: prep.remetente, email_id: prep.email_id,\n` +
  `  payload: { contents: [{ role: 'user', parts: [{ text: prompt }] }],\n` +
  `    generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } } } };\n`;

/* ---------- Processar: linhas para COTACOES ---------- */
const jsProcessar =
  `const ctx = $('Montar').item.json;\n` +
  `let dados = { itens: [], condicoes_gerais: '' };\n` +
  `try { dados = JSON.parse($json.candidates[0].content.parts[0].text); } catch (e) {}\n` +
  `const hoje = new Date().toISOString().slice(0, 10);\n` +
  `const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '' : Number(v);\n` +
  // #15: o LLM as vezes devolve objeto/array em prazo, frete ou condicoes —
  // String() nisso virava '[object Object]' na planilha
  `const txt = (v) => {\n` +
  `  if (v === null || v === undefined) return '';\n` +
  `  if (typeof v === 'string') return v;\n` +
  `  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join('; ');\n` +
  `  if (typeof v === 'object') return Object.keys(v).map(k => k + ': ' + txt(v[k])).filter(Boolean).join('; ');\n` +
  `  return String(v);\n` +
  `};\n` +
  // só entra na COTACOES item que tenha ALGUM preço: resposta sem preço (aviso
  // automático, "recebemos seu pedido", auto-resposta de agente) não é cotação
  `const comPreco = (Array.isArray(dados.itens) ? dados.itens.slice(0, 40) : [])\n` +
  `  .filter(i => num(i.preco_unit) !== '' || num(i.preco_total) !== '');\n` +
  `const values = comPreco.map(i => [\n` +
  `  ctx.pedido, String(i.item_no ?? 0), String(i.descricao || '').slice(0, 200), ctx.fornecedor, ctx.remetente,\n` +
  `  num(i.preco_unit), num(i.preco_total), (txt(i.prazo) || txt(dados.prazo) || txt(dados.prazo_entrega)).slice(0, 60), (txt(i.frete) || txt(dados.frete)).slice(0, 60),\n` +
  `  txt(dados.condicoes_gerais).slice(0, 200), hoje, ctx.email_id, '', txt(i.obs).slice(0, 200),\n` +
  `]);\n` +
  `return { json: { n: values.length, semPrecos: !values.length,\n` +
  `  url: ${JSON.stringify(SHEETS)} + '/values/COTACOES!A1:append?valueInputOption=RAW', corpo: { values } } };\n`;

/* ---------- Aviso à Daniela ---------- */
const jsAviso =
  `const ctx = $('Montar').item.json;\n` +
  `const p = $('Processar').item.json;\n` +
  `let corpo;\n` +
  `if (p.semPrecos) {\n` +
  `  corpo = 'Oi, Daniela!\\n\\nO fornecedor ' + ctx.fornecedor + ' respondeu o e-mail da cotacao do pedido ' +\n` +
  `    (ctx.pedido || '?') + ', mas NAO consegui reconhecer precos na resposta. Nao lancei nada na planilha.\\n' +\n` +
  `    'Vale abrir o e-mail dele na caixa da Bella e verificar.\\n\\nBella — Assistente de Compras | Prisbel Construtora';\n` +
  `} else {\n` +
  `  corpo = 'Oi, Daniela!\\n\\nChegou resposta de cotacao:\\n' +\n` +
  `    'Fornecedor: ' + ctx.fornecedor + '\\nPedido: ' + (ctx.pedido || '?') + '\\nItens reconhecidos: ' + p.n +\n` +
  `    '\\n\\nJa lancei tudo na aba COTACOES. Voce pode ver o comparativo me perguntando no chat: ' +\n` +
  `    'como estao as cotacoes do pedido ' + (ctx.pedido || '') + '?\\n\\n' +\n` +
  `    'Bella — Assistente de Compras | Prisbel Construtora';\n` +
  `}\n` +
  `return { json: { para: ${JSON.stringify(EMAIL_DANIELA)},\n` +
  `  assuntoAviso: (p.semPrecos ? 'Resposta SEM precos — Pedido ' : 'Cotacao recebida — Pedido ') + (ctx.pedido || '?') + ' (' + ctx.fornecedor + ')', corpo } };\n`;

/* ---------- workflow ---------- */
const NAME = 'WF5 - Leitura de Cotacoes';
const CRED_SHEETS = { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } };
const CRED_GMAIL = { gmailOAuth2: { id: 'WhxkPdGziEvCRIqD', name: 'Gmail ssysbot' } };
const workflow = {
  name: NAME,
  settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'Gmail Trigger', type: 'n8n-nodes-base.gmailTrigger', typeVersion: 1.2, position: [0, 0],
      parameters: { pollTimes: { item: [{ mode: 'everyMinute' }] }, simple: false,
        filters: { q: 'subject:Cotacao is:unread' }, options: {} },
      credentials: CRED_GMAIL },
    { name: 'Preparar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [200, 0],
      parameters: { jsCode: jsPreparar } },
    { name: 'Ler dados', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [400, 0],
      alwaysOutputData: true,
      parameters: { method: 'GET',
        url: `${SHEETS}/values:batchGet?ranges=FORNECEDORES!A1:D60&ranges=PEDIDOS!A1:P200`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
      credentials: CRED_SHEETS },
    { name: 'Montar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [600, 0],
      parameters: { mode: 'runOnceForEachItem', jsCode: jsMontar } },
    { name: 'Gemini', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [800, 0],
      parameters: { method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.payload) }}', options: {} },
      credentials: { httpHeaderAuth: { id: 'MgtrdiyIibEc7OYw', name: 'Gemini' } } },
    { name: 'Processar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1000, 0],
      parameters: { mode: 'runOnceForEachItem', jsCode: jsProcessar } },
    { name: 'Gravar COTACOES', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1200, 0],
      parameters: { method: 'POST', url: '={{ $json.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.corpo) }}', options: {} },
      credentials: CRED_SHEETS },
    { name: 'Tem precos?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1100, 120],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-precos', leftValue: "={{ $json.semPrecos ? 'nao' : 'sim' }}", rightValue: 'sim',
          operator: { type: 'string', operation: 'equals' } }],
      } } },
    { name: 'Preparar aviso', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1400, 0],
      parameters: { mode: 'runOnceForEachItem', jsCode: jsAviso } },
    { name: 'Avisar Daniela', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1600, 0],
      onError: 'continueRegularOutput',
      parameters: { operation: 'send', sendTo: '={{ $json.para }}', subject: '={{ $json.assuntoAviso }}',
        emailType: 'text', message: '={{ $json.corpo }}', options: { appendAttribution: false } },
      credentials: CRED_GMAIL },
    { name: 'Marcar como lido', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1800, 0],
      onError: 'continueRegularOutput',
      parameters: { operation: 'markAsRead', messageId: '={{ $(\'Preparar\').first().json.email_id }}' },
      credentials: CRED_GMAIL },
  ],
  connections: {
    'Gmail Trigger': { main: [[{ node: 'Preparar', type: 'main', index: 0 }]] },
    'Preparar': { main: [[{ node: 'Ler dados', type: 'main', index: 0 }]] },
    'Ler dados': { main: [[{ node: 'Montar', type: 'main', index: 0 }]] },
    'Montar': { main: [[{ node: 'Gemini', type: 'main', index: 0 }]] },
    'Gemini': { main: [[{ node: 'Processar', type: 'main', index: 0 }]] },
    'Processar': { main: [[{ node: 'Tem precos?', type: 'main', index: 0 }]] },
    'Tem precos?': { main: [
      [{ node: 'Gravar COTACOES', type: 'main', index: 0 }],
      [{ node: 'Preparar aviso', type: 'main', index: 0 }],
    ] },
    'Gravar COTACOES': { main: [[{ node: 'Preparar aviso', type: 'main', index: 0 }]] },
    'Preparar aviso': { main: [[{ node: 'Avisar Daniela', type: 'main', index: 0 }]] },
    'Avisar Daniela': { main: [[{ node: 'Marcar como lido', type: 'main', index: 0 }]] },
  },
};

const list = await api('GET', `/workflows?name=${encodeURIComponent(NAME)}`);
const existing = list.data?.[0];
let id;
if (existing) {
  id = existing.id;
  if (existing.active) await api('POST', `/workflows/${id}/deactivate`);
  await api('PUT', `/workflows/${id}`, workflow);
  console.log('WF5 atualizado:', id);
} else {
  id = (await api('POST', '/workflows', workflow)).id;
  console.log('WF5 criado:', id);
}
await api('POST', `/workflows/${id}/activate`);
console.log('WF5 ativo. Trigger: subject:Cotacao is:unread (1/min)');
