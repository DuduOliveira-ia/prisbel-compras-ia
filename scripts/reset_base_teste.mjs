// Reset da base para teste completo: faz backup (abas *_BAK_1008) e limpa as
// abas OPERACIONAIS da planilha — PEDIDOS, CONVERSAS, COTACOES, MEMORIA —
// preservando cabeçalhos e SEM tocar em cadastros/conhecimento (OBRAS, PESSOAS,
// FORNECEDORES, CONTRATOS_COMPRAS, FATOS, DOCUMENTOS, ACESSOS, REQUISITOS,
// LISTAS) nem nas abas de locações (CONTRATOS, LOG).
// Usa workflow utilitário efêmero com a credencial Google Sheets do n8n
// (padrão criar→ativar→chamar→apagar). Uso: node scripts/reset_base_teste.mjs
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
const SUFIXO_BAK = '_BAK_1008';
// aba → última coluna dos dados
const ABAS = { PEDIDOS: 'P', CONVERSAS: 'G', COTACOES: 'N', MEMORIA: 'E' };

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const path = 'prisbel-temp-reset-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-reset-base (apagar)',
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
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;

try {
  for (const [aba, ultCol] of Object.entries(ABAS)) {
    // 1. lê tudo (para o backup e para o relatório)
    const leitura = await call(`${base}/values:batchGetByDataFilter`,
      { dataFilters: [{ a1Range: `${aba}!A1:${ultCol}5000` }] });
    const values = (leitura.valueRanges && leitura.valueRanges[0].valueRange.values) || [];
    const nDados = Math.max(0, values.length - 1);
    // 2. cria a aba de backup (se já existir, segue sem duplicar)
    const bak = `${aba}${SUFIXO_BAK}`;
    const add = await call(`${base}:batchUpdate`,
      { requests: [{ addSheet: { properties: { title: bak } } }] });
    const jaExistia = !!(add.error && /already exists/i.test(add.error.message || ''));
    if (add.error && !jaExistia) throw new Error(`addSheet ${bak}: ${add.error.message}`);
    // 3. grava o conteúdo no backup
    if (values.length && !jaExistia) {
      const up = await call(`${base}/values:batchUpdateByDataFilter`,
        { valueInputOption: 'RAW', data: [{ dataFilter: { a1Range: `${bak}!A1` }, values }] });
      if (up.error) throw new Error(`backup ${bak}: ${up.error.message}`);
    }
    // 4. limpa os dados da aba original (preserva a linha 1 de cabeçalho)
    const clr = await call(`${base}/values:batchClearByDataFilter`,
      { dataFilters: [{ a1Range: `${aba}!A2:${ultCol}5000` }] });
    if (clr.error) throw new Error(`clear ${aba}: ${clr.error.message}`);
    console.log(`${aba}: ${nDados} linha(s) de dados → backup em ${bak}${jaExistia ? ' (já existia, não sobrescrito)' : ''}, aba limpa`);
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
  console.log('workflow temporario removido');
}
