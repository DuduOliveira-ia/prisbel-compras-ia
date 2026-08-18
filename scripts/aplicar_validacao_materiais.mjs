// Aplica a validação da Daniela (planilha "Bella - Materiais para validacao
// (Daniela) e Teste Preenchido.xlsx", devolvida em 17/08, aba "Grupos (resumo)")
// na coluna K (VALIDADO POR (Daniela)) da aba MATERIAIS. Só registro/auditoria
// — não toca REQUISITOS (produção). Uso: node scripts/aplicar_validacao_materiais.mjs
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

// decisão da Daniela por grupo_compra, lida da aba "Grupos (resumo)" do xlsx devolvido
const VALIDADO = {
  'CANTEIRO DE OBRAS': 'NÃO', 'ELETRICO': 'SIM', 'HIDRAULICO': 'SIM', 'SEGURANÇA': 'NÃO',
  'PINTURA': 'SIM', 'BLOCO CONCRETO': 'SIM', 'REVESTIMENTO': 'SIM', 'AÇO': 'SIM',
  'CIMENTICIOS': 'SIM', 'GESSO': 'SIM', 'MADEIRAS': 'SIM', 'IMPERMEABILIZANTES': 'SIM',
  'INCENDIO': 'SIM', 'PRE MOLDADOS': 'SIM', 'BLOCO CERAMICO': 'SIM', 'LIMPEZA': 'NÃO',
  'FERRAMENTAS': 'NÃO', 'ALIMENTAÇAO': 'NÃO', 'AGREGADOS': 'SIM', 'MATERIAL ESCRITORIO': 'NÃO',
  'PAISAGISMO': 'NÃO', 'UNIFORME': 'NÃO', 'GAS': 'SIM', 'SEM GRUPO': 'NÃO', 'CONCRETO': 'SIM',
  'SERVIÇOS': '—', // serviço, não passa por classificação de material — não se aplica
};

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-valmat-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-valmat (apagar)', settings: { executionOrder: 'v1' },
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
  const res = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: 'MATERIAIS!A2:A30' }] });
  const grupos = ((res.valueRanges && res.valueRanges[0].valueRange.values) || []).map(r => r[0]);
  if (!grupos.length) throw new Error('aba MATERIAIS veio vazia — abortando');
  const faltando = grupos.filter(g => !(g in VALIDADO));
  if (faltando.length) throw new Error('grupo sem validação mapeada: ' + faltando.join(', '));
  const valores = grupos.map(g => [VALIDADO[g]]);
  const up = await call(`${base}/values:batchUpdate`,
    { valueInputOption: 'RAW', data: [{ range: `MATERIAIS!K2`, values: valores }] });
  if (up.error) throw new Error(up.error.message);
  console.log(`aba MATERIAIS!K: ${up.totalUpdatedCells} células gravadas (${grupos.length} grupos)`);
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
