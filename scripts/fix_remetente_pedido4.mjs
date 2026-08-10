// Ajuste pontual: aponta o REMETENTE (col C) do pedido 4 da fila PEDIDOS para
// o Gmail de teste do almoxarife (mentoriawiki@gmail.com), para testar a ação
// de cobrança de pendência da Bella (WF7). Usa workflow utilitário efêmero
// com a credencial Google Sheets do n8n (padrão criar→ativar→chamar→apagar).
// Uso: node scripts/fix_remetente_pedido4.mjs
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
const PEDIDO = '4';
const NOVO_REMETENTE = 'mentoriawiki@gmail.com';

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const path = 'prisbel-temp-remetente-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-remetente-pedido4 (apagar)',
  settings: { executionOrder: 'v1' },
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
  return r.json();
};

try {
  const leitura = await call(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchGetByDataFilter`,
    { dataFilters: [{ a1Range: 'PEDIDOS!A1:P200' }] },
  );
  const rows = leitura.valueRanges[0].valueRange.values;
  const alvos = [];
  rows.forEach((r, i) => {
    if (String(r[0]) === PEDIDO) alvos.push({ linha: i + 1, remetente: r[2], item: r[7] });
  });
  console.log(`pedido ${PEDIDO}:`, JSON.stringify(alvos));
  for (const a of alvos) {
    const up = await call(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchUpdateByDataFilter`,
      { valueInputOption: 'RAW', data: [{ dataFilter: { a1Range: `PEDIDOS!C${a.linha}` }, values: [[NOVO_REMETENTE]] }] },
    );
    console.log(`linha ${a.linha}: C atualizada (${up.totalUpdatedCells} celula)`);
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
  console.log('workflow temporario removido');
}
