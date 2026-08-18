// Leitura pontual da aba REQUISITOS (produção) e MATERIAIS, só para checar
// esquema antes de aplicar a validação da Daniela. Somente leitura, apaga o
// workflow temporário ao final. Uso: node scripts/ler_requisitos.mjs
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
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-ler-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-ler (apagar)', settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'W', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: 'POST', path: p, responseMode: 'lastNode' } },
    { name: 'H', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, 0],
      parameters: { method: '={{ $json.body.metodo || "POST" }}', url: '={{ $json.body.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: '={{ ($json.body.metodo || "POST") === "POST" }}', specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.body.corpo || {}) }}', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
  ],
  connections: { W: { main: [[{ node: 'H', type: 'main', index: 0 }]] } },
});
await api('POST', `/workflows/${wf.id}/activate`);
const call = async (url, corpo, metodo) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, corpo, metodo }) });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;
try {
  for (const aba of ['REQUISITOS', 'MATERIAIS']) {
    const res = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: `${aba}!A1:Z60` }] });
    const vals = (res.valueRanges && res.valueRanges[0].valueRange.values) || [];
    console.log(`=== ${aba} (${vals.length} linhas lidas) ===`);
    if (!vals.length) { console.log('  (vazia)\n'); continue; }
    console.log('  COLS:', vals[0].map((c, i) => `${String.fromCharCode(65 + i)}=${c}`).join(' | '));
    for (const r of vals.slice(1)) console.log('   >', r.map(c => String(c).slice(0, 45)).join(' | '));
    console.log('');
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
