// Leitor genérico de aba da planilha da Bella (somente leitura), para inspeção
// pontual sem abrir o navegador. Uso:
//   node scripts/ler_aba.mjs FORNECEDORES            (primeiras 30 linhas)
//   node scripts/ler_aba.mjs PEDIDOS A1:P400 --tail  (últimas linhas do range)
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
const SHEET = env.SHEET_ID || '1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const tail = process.argv.includes('--tail');
const aba = args[0];
const range = args[1] || 'A1:Z40';
if (!aba) { console.error('uso: node scripts/ler_aba.mjs ABA [A1:Z40] [--tail]'); process.exit(1); }

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-lerab-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-lerab (apagar)', settings: { executionOrder: 'v1' },
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
try {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchGetByDataFilter`,
      corpo: { dataFilters: [{ a1Range: `${aba}!${range}` }] } }) });
  const j = JSON.parse(await r.text());
  const vals = (j.valueRanges && j.valueRanges[0].valueRange.values) || [];
  if (!vals.length) { console.log('(vazia)'); }
  else {
    console.log('COLS:', vals[0].map((c, i) => `${String.fromCharCode(65 + i)}=${c}`).join(' | '));
    const corpo = vals.slice(1);
    const mostrar = tail ? corpo.slice(-15) : corpo;
    for (const row of mostrar) console.log(' >', row.map(c => String(c).slice(0, 38)).join(' | '));
    console.log(`(${corpo.length} linhas de dados)`);
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
