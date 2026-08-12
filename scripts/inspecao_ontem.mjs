// Inspeção pós-apresentação (11/08): lê PEDIDOS e CONVERSAS para investigar
// duplicações (7/8, 9/10). Somente leitura, via workflow utilitário efêmero.
// Uso: node scripts/inspecao_ontem.mjs
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
const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const path = 'prisbel-temp-inspecao-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-inspecao (apagar)', settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'W', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: 'POST', path, responseMode: 'lastNode' } },
    { name: 'H', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, 0],
      parameters: { method: 'POST', url: '={{ $json.body.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body.corpo) }}', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
  ],
  connections: { W: { main: [[{ node: 'H', type: 'main', index: 0 }]] } },
});
await api('POST', `/workflows/${wf.id}/activate`);
const call = async (url, corpo) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, corpo }),
  });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

try {
  const leitura = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchGetByDataFilter`,
    { dataFilters: [{ a1Range: 'PEDIDOS!A1:P300' }, { a1Range: 'CONVERSAS!A1:G2000' }] });
  const vrs = leitura.valueRanges.map(v => v.valueRange.values || []);
  const ped = vrs[0].slice(1);
  console.log('=== PEDIDOS (num | dh | canal | nome | obra | item | quant | unid | status | pend) ===');
  for (const r of ped) {
    console.log([r[0], r[1], r[2], r[3], r[4], String(r[7] || '').slice(0, 45), r[8], r[9], r[11], String(r[12] || '').slice(0, 30)].join(' | '));
  }
  const conv = vrs[1].slice(1);
  console.log(`\n=== CONVERSAS: ${conv.length} mensagens ===`);
  // agrupa por conversa e mostra as trocas com timestamps (para medir percepção de espera)
  const porConv = {};
  for (const r of conv) {
    (porConv[r[0]] = porConv[r[0]] || []).push({ ts: r[3], de: r[5], txt: String(r[6] || '').replace(/<[^>]+>/g, ' ').slice(0, 110) });
  }
  for (const k of Object.keys(porConv)) {
    const ms = porConv[k];
    console.log(`\n--- conversa ${k} (${ms.length} msgs, inicio ${ms[0].ts}) ---`);
    for (const m of ms) console.log(`  [${String(m.ts).slice(11, 19)}] ${m.de}: ${m.txt}`);
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
