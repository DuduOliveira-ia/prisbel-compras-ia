// Publica/atualiza o WF8 - Bella Admin no n8n:
//   GET  /webhook/bella-admin      → painel admin (painel/bella-admin-v0.1.html)
//   POST /webhook/bella-admin-api  → ações: farol, acessos, acesso_criar,
//        acesso_revogar, aba, linha_add, docs, doc_upload (Gemini extrai texto)
// Uso: node scripts/deploy_bella_admin.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
let envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
if (!env.BELLA_ADMIN_TOKEN) {
  env.BELLA_ADMIN_TOKEN = 'pbadm-' + randomBytes(9).toString('hex');
  envText += (envText.endsWith('\n') ? '' : '\n') + `BELLA_ADMIN_TOKEN=${env.BELLA_ADMIN_TOKEN}\n`;
  writeFileSync(envPath, envText);
  console.log('BELLA_ADMIN_TOKEN gerado e salvo no .env');
}
const { N8N_API_KEY, N8N_BASE_URL, SHEET_ID, BELLA_ADMIN_TOKEN } = env;

const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

/* ---------------- página ---------------- */
const page = '<!DOCTYPE html>\n<html lang="pt-BR">\n<meta charset="utf-8">\n' +
  readFileSync(join(root, 'painel', 'bella-admin-v0.1.html'), 'utf8') + '\n</html>';
const NEGADO_HTML = '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Bella Admin</title>' +
  '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
  '<p>Acesso restrito.</p></body></html>';
const jsServe =
  `const token = ${JSON.stringify(BELLA_ADMIN_TOKEN)};\n` +
  `const ok = ($json.query || {}).t === token;\n` +
  `const html = ok ? ${JSON.stringify(page)} : ${JSON.stringify(NEGADO_HTML)};\n` +
  `return [{ json: { html } }];\n`;

/* ---------------- roteador de ações ---------------- */
const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
const jsRotear =
  `const token = ${JSON.stringify(BELLA_ADMIN_TOKEN)};\n` +
  `const b = $json.body || {};\n` +
  `const S = ${JSON.stringify(SHEETS)};\n` +
  `const hoje = new Date().toISOString().slice(0, 10);\n` +
  `const ABAS_OK = { OBRAS: 1, PESSOAS: 1, CONTRATOS_COMPRAS: 1, FATOS: 1, LISTAS: 1, FORNECEDORES: 1, CONFIG: 1 };\n` +
  `if (b.t !== token) return [{ json: { fase: 'negado', acao: b.acao || '' } }];\n` +
  `const acao = String(b.acao || '');\n` +
  `let out = { fase: 'sheets', acao, metodo: 'GET', url: '', corpo: null };\n` +
  `if (acao === 'farol') {\n` +
  `  out.url = S + '/values:batchGet?ranges=ACESSOS!A2:H200&ranges=DOCUMENTOS!A2:H500&ranges=PEDIDOS!A2:B2000';\n` +
  `} else if (acao === 'acessos') {\n` +
  `  out.url = S + '/values/ACESSOS!A2:H200';\n` +
  `} else if (acao === 'acesso_criar') {\n` +
  `  out.metodo = 'POST';\n` +
  `  out.url = S + '/values/ACESSOS!A1:append?valueInputOption=RAW';\n` +
  `  out.corpo = { values: [[ 'AC-' + Date.now(), String(b.nome||'').slice(0,60), String(b.papel||'').slice(0,30),\n` +
  `    String(b.obra_padrao||'').slice(0,40), String(b.token||'').slice(0,60), String(b.expira_em||'').slice(0,10), 'TRUE', hoje ]] };\n` +
  `  if (!b.nome || !b.token || !b.expira_em) return [{ json: { fase: 'negado', acao } }];\n` +
  `} else if (acao === 'acesso_revogar') {\n` +
  `  const linha = parseInt(b.linha, 10);\n` +
  `  if (!linha || linha < 2 || linha > 500) return [{ json: { fase: 'negado', acao } }];\n` +
  `  out.metodo = 'PUT';\n` +
  `  out.url = S + '/values/ACESSOS!G' + linha + '?valueInputOption=RAW';\n` +
  `  out.corpo = { values: [['FALSE']] };\n` +
  `} else if (acao === 'aba') {\n` +
  `  const aba = String(b.aba || '');\n` +
  `  if (!ABAS_OK[aba]) return [{ json: { fase: 'negado', acao } }];\n` +
  `  out.url = S + '/values/' + aba + '!A1:Z300';\n` +
  `} else if (acao === 'linha_add') {\n` +
  `  const aba = String(b.aba || '');\n` +
  `  if (!ABAS_OK[aba] || !Array.isArray(b.valores)) return [{ json: { fase: 'negado', acao } }];\n` +
  `  out.metodo = 'POST';\n` +
  `  out.url = S + '/values/' + aba + '!A1:append?valueInputOption=RAW';\n` +
  `  out.corpo = { values: [ b.valores.slice(0, 26).map(v => String(v).slice(0, 500)) ] };\n` +
  `} else if (acao === 'docs') {\n` +
  `  out.url = S + '/values/DOCUMENTOS!A2:H500';\n` +
  `} else if (acao === 'doc_upload') {\n` +
  `  if (!b.data || typeof b.data !== 'string' || b.data.length > 13000000) return [{ json: { fase: 'negado', acao } }];\n` +
  `  const prompt = 'Transcreva INTEGRALMENTE o texto deste documento em portugues, preservando titulos, listas e tabelas ' +\n` +
  `    '(tabelas como linhas de texto com separador |). Nao resuma, nao comente, nao invente. ' +\n` +
  `    'Responda SOMENTE com JSON valido: {\\"texto\\": \\"conteudo integral\\"}';\n` +
  `  return [{ json: { fase: 'gemini', acao,\n` +
  `    meta: { obra_id: String(b.obra_id||''), tipo: String(b.tipo||'OUTRO'), titulo: String(b.titulo||'Documento').slice(0,120), versao: String(b.versao||'v1').slice(0,20) },\n` +
  `    payload: {\n` +
  `      contents: [{ role: 'user', parts: [ { text: prompt }, { inline_data: { mime_type: String(b.mime||'application/pdf').slice(0,50), data: b.data } } ] }],\n` +
  `      generationConfig: { temperature: 0, maxOutputTokens: 60000, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },\n` +
  `    } } }];\n` +
  `} else { return [{ json: { fase: 'negado', acao } }]; }\n` +
  `return [{ json: out }];\n`;

/* ---------------- preparar doc (pós-Gemini) ---------------- */
const jsPrepararDoc =
  `const rot = $('Rotear').first().json;\n` +
  `let texto = '';\n` +
  `try {\n` +
  `  const raw = $json.candidates[0].content.parts[0].text;\n` +
  `  try { texto = String(JSON.parse(raw).texto || ''); } catch (e) { texto = String(raw); }\n` +
  `} catch (e) {}\n` +
  `texto = texto.trim();\n` +
  `const m = rot.meta;\n` +
  `const docId = 'DC-' + Date.now();\n` +
  `const hoje = new Date().toISOString().slice(0, 10);\n` +
  `const partes = [];\n` +
  `for (let i = 0; i < texto.length; i += 40000) partes.push(texto.slice(i, i + 40000));\n` +
  `if (!partes.length) partes.push('');\n` +
  `const values = partes.map((chunk, i) => [ docId, m.obra_id, m.tipo,\n` +
  `  m.titulo + (partes.length > 1 ? ' (parte ' + (i + 1) + ')' : ''), '', m.versao, hoje, chunk ]);\n` +
  `return [{ json: { chars: texto.length, partes: partes.length,\n` +
  `  metodo: 'POST', url: ${JSON.stringify(SHEETS)} + '/values/DOCUMENTOS!A1:append?valueInputOption=RAW',\n` +
  `  corpo: { values } } }];\n`;

/* ---------------- formatar resposta ---------------- */
const jsFormatar =
  `const rot = $('Rotear').first().json;\n` +
  `const acao = rot.acao;\n` +
  `const falhou = !!($json.error) || ($json.statusCode && $json.statusCode >= 400);\n` +
  `let resp = { ok: !falhou };\n` +
  `const vr = $json.valueRanges;\n` +
  `if (acao === 'farol') {\n` +
  `  const ac = (vr && vr[0] && vr[0].values) || [];\n` +
  `  const dc = (vr && vr[1] && vr[1].values) || [];\n` +
  `  const pd = (vr && vr[2] && vr[2].values) || [];\n` +
  `  const hoje = new Date().toISOString().slice(0, 10);\n` +
  `  resp = { ok: true, google_ok: !!vr,\n` +
  `    acessos_ativos: ac.filter(r => String(r[6]).toUpperCase() === 'TRUE' && (!r[5] || r[5] >= hoje)).length,\n` +
  `    docs: new Set(dc.map(r => r[0]).filter(Boolean)).size,\n` +
  `    pedidos: new Set(pd.map(r => r[0]).filter(Boolean)).size,\n` +
  `    ultimo_pedido: pd.length ? String(pd[pd.length - 1][1] || '') : '' };\n` +
  `} else if (acao === 'acessos') {\n` +
  `  resp = { ok: true, linhas: $json.values || [] };\n` +
  `} else if (acao === 'aba') {\n` +
  `  const rows = $json.values || [];\n` +
  `  resp = { ok: true, cabecalho: rows[0] || [], linhas: rows.slice(1) };\n` +
  `} else if (acao === 'docs') {\n` +
  `  const rows = $json.values || [];\n` +
  `  const map = {};\n` +
  `  for (const r of rows) {\n` +
  `    if (!r[0]) continue;\n` +
  `    if (!map[r[0]]) map[r[0]] = { titulo: String(r[3]||'').replace(/ \\(parte \\d+\\)$/, ''), obra: r[1]||'(geral)', tipo: r[2]||'', versao: r[5]||'', atualizado: r[6]||'', chars: 0, partes: 0 };\n` +
  `    map[r[0]].chars += String(r[7]||'').length; map[r[0]].partes++;\n` +
  `  }\n` +
  `  resp = { ok: true, docs: Object.values(map) };\n` +
  `} else if (acao === 'doc_upload') {\n` +
  `  const prep = $('Preparar doc').first().json;\n` +
  `  resp = { ok: !falhou, chars: prep.chars, partes: prep.partes };\n` +
  `}\n` +
  `return [{ json: { resposta: resp } }];\n`;

/* ---------------- workflow ---------------- */
const NAME = 'WF8 - Bella Admin';
const CRED_SHEETS = { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } };
const respondJson = (name, body, pos) => ({
  name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos,
  parameters: { respondWith: 'text', responseBody: body,
    options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }] } } },
});
const iff = (name, leftExpr, val, pos) => ({
  name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: pos,
  parameters: { conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    combinator: 'and',
    conditions: [{ id: 'c1', leftValue: leftExpr, rightValue: val,
      operator: { type: 'string', operation: 'equals' } }],
  } },
});
const workflow = {
  name: NAME,
  settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'Página', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, -200],
      webhookId: 'b8c00001-0000-4000-8000-000000000001',
      parameters: { httpMethod: 'GET', path: 'bella-admin', responseMode: 'responseNode', options: {} } },
    { name: 'Servir admin', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, -200],
      parameters: { jsCode: jsServe } },
    { name: 'Responder página', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, -200],
      parameters: { respondWith: 'text', responseBody: '={{ $json.html }}',
        options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } } } },

    { name: 'API Admin', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 120],
      webhookId: 'b8c00002-0000-4000-8000-000000000002',
      parameters: { httpMethod: 'POST', path: 'bella-admin-api', responseMode: 'responseNode', options: {} } },
    { name: 'Rotear', type: 'n8n-nodes-base.code', typeVersion: 2, position: [190, 120],
      parameters: { jsCode: jsRotear } },
    iff('Autorizado?', '={{ $json.fase === \'negado\' ? \'nao\' : \'sim\' }}', 'sim', [370, 120]),
    iff('É upload?', '={{ $json.fase }}', 'gemini', [560, 60]),
    { name: 'Gemini Extrair', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [760, -40],
      executeOnce: true,
      parameters: { method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.payload) }}',
        options: { timeout: 180000 } },
      credentials: { httpHeaderAuth: { id: 'MgtrdiyIibEc7OYw', name: 'Gemini' } } },
    { name: 'Preparar doc', type: 'n8n-nodes-base.code', typeVersion: 2, position: [960, -40],
      parameters: { jsCode: jsPrepararDoc } },
    { name: 'Sheets Doc', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1160, -40],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: 'POST', url: '={{ $json.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.corpo) }}', options: {} },
      credentials: CRED_SHEETS },
    { name: 'Sheets Genérico', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [760, 200],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: '={{ $json.metodo }}', url: '={{ $json.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: '={{ $json.metodo !== \'GET\' }}', specifyBody: 'json',
        jsonBody: '={{ $json.corpo ? JSON.stringify($json.corpo) : \'{}\' }}', options: {} },
      credentials: CRED_SHEETS },
    { name: 'Formatar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1360, 120],
      parameters: { jsCode: jsFormatar } },
    respondJson('Responder API', '={{ JSON.stringify($json.resposta) }}', [1560, 120]),
    respondJson('Responder negado', JSON.stringify({ ok: false, erro: 'nao autorizado' }), [560, 320]),
  ],
  connections: {
    'Página': { main: [[{ node: 'Servir admin', type: 'main', index: 0 }]] },
    'Servir admin': { main: [[{ node: 'Responder página', type: 'main', index: 0 }]] },
    'API Admin': { main: [[{ node: 'Rotear', type: 'main', index: 0 }]] },
    'Rotear': { main: [[{ node: 'Autorizado?', type: 'main', index: 0 }]] },
    'Autorizado?': { main: [
      [{ node: 'É upload?', type: 'main', index: 0 }],
      [{ node: 'Responder negado', type: 'main', index: 0 }],
    ] },
    'É upload?': { main: [
      [{ node: 'Gemini Extrair', type: 'main', index: 0 }],
      [{ node: 'Sheets Genérico', type: 'main', index: 0 }],
    ] },
    'Gemini Extrair': { main: [[{ node: 'Preparar doc', type: 'main', index: 0 }]] },
    'Preparar doc': { main: [[{ node: 'Sheets Doc', type: 'main', index: 0 }]] },
    'Sheets Doc': { main: [[{ node: 'Formatar', type: 'main', index: 0 }]] },
    'Sheets Genérico': { main: [[{ node: 'Formatar', type: 'main', index: 0 }]] },
    'Formatar': { main: [[{ node: 'Responder API', type: 'main', index: 0 }]] },
  },
};

/* ---------------- cria/atualiza + bounce + smoke ---------------- */
const list = await api('GET', `/workflows?name=${encodeURIComponent(NAME)}`);
const existing = list.data?.[0];
let id;
if (existing) {
  id = existing.id;
  if (existing.active) await api('POST', `/workflows/${id}/deactivate`);
  await api('PUT', `/workflows/${id}`, workflow);
  console.log('workflow atualizado:', id);
} else {
  id = (await api('POST', '/workflows', workflow)).id;
  console.log('workflow criado:', id);
}
await api('POST', `/workflows/${id}/activate`);

const pg = await fetch(`${N8N_BASE_URL}/webhook/bella-admin?t=${BELLA_ADMIN_TOKEN}`);
console.log(`página → HTTP ${pg.status}, admin: ${(await pg.text()).includes('Bella Admin')}`);
const farol = await fetch(`${N8N_BASE_URL}/webhook/bella-admin-api`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ t: BELLA_ADMIN_TOKEN, acao: 'farol' }),
});
console.log(`farol → HTTP ${farol.status}: ${await farol.text()}`);
const neg = await fetch(`${N8N_BASE_URL}/webhook/bella-admin-api`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ t: 'errado', acao: 'farol' }),
});
console.log(`negado → ${await neg.text()}`);
console.log(`\nURL admin: ${N8N_BASE_URL}/webhook/bella-admin?t=${BELLA_ADMIN_TOKEN}`);
