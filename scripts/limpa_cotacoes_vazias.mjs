// Remove da COTACOES as linhas SEM preço (colunas F e G vazias) — sujeira das
// auto-respostas sem valor. Preserva cabeçalho e linhas com preço, reescrevendo
// a aba compactada. Usa workflow utilitário efêmero (padrão do projeto).
// Uso: node scripts/limpa_cotacoes_vazias.mjs
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

const path = 'prisbel-temp-limpacot-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-limpa-cotacoes (apagar)', settings: { executionOrder: 'v1' },
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
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; }
};

try {
  const leitura = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchGetByDataFilter`,
    { dataFilters: [{ a1Range: 'COTACOES!A1:N500' }] });
  const rows = (leitura.valueRanges && leitura.valueRanges[0].valueRange.values) || [];
  const cab = rows[0] ? [rows[0]] : [];
  const dados = rows.slice(1);
  const mantidas = dados.filter(r => String(r[5] ?? '').trim() !== '' || String(r[6] ?? '').trim() !== '');
  const removidas = dados.length - mantidas.length;
  if (!removidas) { console.log('nenhuma linha vazia — nada a fazer'); }
  else {
    const clr = await call(`${'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET}/values:batchClearByDataFilter`,
      { dataFilters: [{ a1Range: 'COTACOES!A2:N500' }] });
    if (clr.error) throw new Error(clr.error.message);
    if (mantidas.length) {
      const up = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/COTACOES!A2:append?valueInputOption=RAW`,
        { values: mantidas });
      if (up.error) throw new Error(up.error.message);
    }
    console.log(`removidas ${removidas} linha(s) sem preço; mantidas ${mantidas.length}`);
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
