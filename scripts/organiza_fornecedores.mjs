// Reorganiza a aba FORNECEDORES para os testes:
//  - nomes DIDÁTICOS (dá pra conferir de bate-pronto na demo)
//  - 1 fornecedor de material CONTROLADO + 2 COMUNS (para comparar preço)
//  - ssysbot@gmail.com NUNCA é fornecedor (é a caixa da própria Bella)
//  - colunas novas NO FIM (E=fornecedor_id, F=tipo, G=ativo) — inserir no meio
//    quebraria WF3/WF5/WF7, que leem por posição (B=nome, C=e-mail)
//  - categorias exatamente como na aba REQUISITOS (fonte da verdade)
// Faz backup em FORNECEDORES_BAK_1308 antes de reescrever.
// Uso: node scripts/organiza_fornecedores.mjs [--dry]
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
const BAK = 'FORNECEDORES_BAK_1308';
const dry = process.argv.includes('--dry');

// --- elenco de fornecedores de teste ---
// As caixas vêm do .env (ou de argumento), para trocar sem editar código:
//   node scripts/organiza_fornecedores.mjs --comum2=novo@email.com
// Chaves: FORN_CONTROLADO, FORN_COMUM1, FORN_COMUM2
const arg = (k) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const EM_CONTROLADO = arg('controlado') || env.FORN_CONTROLADO || 'agente.ssysbot@gmail.com';
const EM_COMUM1 = arg('comum1') || env.FORN_COMUM1 || 'btceog@gmail.com';
const EM_COMUM2 = arg('comum2') || env.FORN_COMUM2 || 'oliveirae.ti@gmail.com';
// a caixa da Bella jamais pode ser fornecedor (cotação sairia dela para ela mesma)
for (const e of [EM_CONTROLADO, EM_COMUM1, EM_COMUM2]) {
  if (/ssysbot@gmail\.com$/i.test(e) && !/agente\./i.test(e)) {
    console.error(`ERRO: ${e} é a caixa da Bella — não pode ser fornecedor.`); process.exit(1);
  }
}
const CONTROLADAS = ['AÇO', 'CIMENTO E ARGAMASSA', 'BLOCO E CERÂMICA', 'FIOS E CABOS', 'MATERIAL ELÉTRICO', 'HIDRÁULICA'];
const COMUNS = ['GERAL', 'EPI', 'LIMPEZA', 'ADMIN'];
const FORNECEDORES = [
  { id: 'FO-001', nome: 'Aço Forte (CONTROLADO)', email: EM_CONTROLADO, tipo: 'CONTROLADO',
    cats: CONTROLADAS, obs: 'teste — unico fornecedor homologado de material controlado' },
  { id: 'FO-002', nome: 'Constru Mais (COMUM 1)', email: EM_COMUM1, tipo: 'COMUM',
    cats: COMUNS, obs: 'teste — concorre com Obra Facil na cotacao de material comum' },
  { id: 'FO-003', nome: 'Obra Fácil (COMUM 2)', email: EM_COMUM2, tipo: 'COMUM',
    cats: COMUNS, obs: 'teste — concorre com Constru Mais na cotacao de material comum' },
];
const CABECALHO = ['CATEGORIA', 'FORNECEDOR', 'E-MAIL', 'OBS', 'fornecedor_id', 'tipo', 'ativo'];
const linhas = [];
for (const f of FORNECEDORES) {
  for (const c of f.cats) linhas.push([c, f.nome, f.email, f.obs, f.id, f.tipo, 'TRUE']);
}

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

console.log(`${FORNECEDORES.length} fornecedores -> ${linhas.length} linhas (1 por categoria)`);
for (const f of FORNECEDORES) console.log(`  ${f.id} ${f.nome} <${f.email}> [${f.tipo}] ${f.cats.length} categorias`);
if (dry) { console.log('DRY RUN — nada alterado.'); process.exit(0); }

const p = 'prisbel-temp-forn-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-fornecedores (apagar)', settings: { executionOrder: 'v1' },
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
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, corpo }),
  });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;

try {
  // 1. backup do que está lá
  const atual = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: 'FORNECEDORES!A1:G60' }] });
  const antes = (atual.valueRanges && atual.valueRanges[0].valueRange.values) || [];
  const add = await call(`${base}:batchUpdate`, { requests: [{ addSheet: { properties: { title: BAK } } }] });
  const jaExistia = !!(add.error && /already exists/i.test(add.error.message || ''));
  if (add.error && !jaExistia) throw new Error(add.error.message);
  if (antes.length && !jaExistia) {
    const bk = await call(`${base}/values/${BAK}!A1:append?valueInputOption=RAW`, { values: antes });
    if (bk.error) throw new Error(bk.error.message);
    console.log(`backup: ${antes.length - 1} linha(s) em ${BAK}`);
  } else if (jaExistia) console.log(`backup ${BAK} já existia — preservado`);

  // 2. limpa e reescreve
  const clr = await call(`${base}/values:batchClearByDataFilter`, { dataFilters: [{ a1Range: 'FORNECEDORES!A1:G60' }] });
  if (clr.error) throw new Error(clr.error.message);
  const up = await call(`${base}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: [{ range: 'FORNECEDORES!A1', values: [CABECALHO, ...linhas] }],
  });
  if (up.error) throw new Error(up.error.message);
  console.log('gravado:', up.totalUpdatedCells, 'células');
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
