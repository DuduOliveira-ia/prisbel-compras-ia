// Verifica o backlog #17: proposta corrigida do mesmo fornecedor deve SUBSTITUIR
// a anterior, nao somar. Uso: node scripts/teste_dedupe_cotacao.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const SHEET = '1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8';
const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
const chat = async (t, mensagem, obra = '', historico = []) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/bella-chat-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t, obra, mensagem, historico }) });
  return (await r.json()).resposta;
};
const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-dedupe-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-dedupe (apagar)', settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'W', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: 'POST', path: p, responseMode: 'lastNode' } },
    { name: 'H', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, 0],
      parameters: { method: 'POST', url: '={{ $json.body.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body.corpo || {}) }}', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
  ],
  connections: { W: { main: [[{ node: 'H', type: 'main', index: 0 }]] } },
});
await api('POST', `/workflows/${wf.id}/activate`);
const call = async (url, corpo) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, corpo }) });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;

try {
  await call(`${base}/values:batchClearByDataFilter`, { dataFilters: [{ a1Range: 'COTACOES!A2:N300' }] });
  // pedido simples de material COMUM (EPI: nao tem contrato, vai a cotacao mesmo)
  const m1 = 'Bella, pra obra Paradiso: 4 rolos de lona preta de 200 micras.';
  let r = await chat('pb-f21398232bf451567a', m1, 'Paradiso');
  if (!/registrad/i.test(strip(r))) {
    r = await chat('pb-f21398232bf451567a', 'Pode registrar', 'Paradiso',
      [{ de: 'usuario', texto: m1 }, { de: 'bella', texto: r }]);
  }
  await new Promise((x) => setTimeout(x, 2500));
  const l = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: 'PEDIDOS!A2:P300' }] });
  const rows = (l.valueRanges && l.valueRanges[0].valueRange.values) || [];
  let num = 0;
  for (const rr of rows) { const n = parseInt(rr[0], 10); if (n > num) num = n; }
  const it = rows.filter((rr) => parseInt(rr[0], 10) === num)[0];
  console.log(`pedido ${num}: ${String(it[7]).slice(0, 40)} | ${it[8]} ${it[9]}`);

  const hoje = new Date().toISOString().slice(0, 10);
  // primeira proposta e depois a CORRIGIDA (mesmo fornecedor, mesmo item)
  await call(`${base}/values/COTACOES!A1:append?valueInputOption=RAW`, { values: [
    [num, it[15], 'lona preta 200 micras', 'Constru Mais (COMUM 1)', 'btceog@gmail.com', 20, '', '3 dias', 'incluso', 'proposta inicial', hoje, 'd1', '', ''],
    [num, it[15], 'lona preta 200 micras', 'Constru Mais (COMUM 1)', 'btceog@gmail.com', 12, '', '3 dias', 'incluso', 'PROPOSTA CORRIGIDA', hoje, 'd2', '', ''],
    [num, it[15], 'lona preta 200 micras', 'Obra Fácil (COMUM 2)', 'megamigosbr@gmail.com', 14, '', '2 dias', 'incluso', 'unica', hoje, 'd3', '', ''],
  ] });
  console.log('injetado: Constru Mais cotou 20,00 e depois CORRIGIU para 12,00; Obra Facil 14,00');

  await new Promise((x) => setTimeout(x, 2000));
  const comp = strip(await chat('pb-f105cf3d5ccd74c189', `Como estão as cotações do pedido ${num}?`));
  console.log('\n' + comp);
  const qtd = parseFloat(String(it[8]).replace(',', '.')) || 20;
  console.log('\n─── ESPERADO ───');
  console.log(`Constru Mais: ${qtd} x 12,00 = R$ ${(qtd * 12).toFixed(2)}  (a corrigida vale; somando as duas daria ${(qtd * 32).toFixed(2)})`);
  console.log(`Obra Fácil:   ${qtd} x 14,00 = R$ ${(qtd * 14).toFixed(2)}`);
  const somou = new RegExp(String((qtd * 32).toFixed(0))).test(comp.replace(/[.,]/g, ''));
  const ok = !somou && /constru\s*mais/i.test(comp);
  console.log('\n' + (ok ? '✅ nao somou: usou a proposta mais recente' : '❌ conferir acima'));
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
