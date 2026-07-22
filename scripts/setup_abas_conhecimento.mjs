// Cria as 5 abas de conhecimento (Esquema de Dados v1.0) na planilha da Bella
// via workflow utilitário efêmero no n8n (usa a credencial Google já existente).
// Fluxo: cria workflow → ativa → chama webhook → mostra resultado → apaga workflow.
// Uso: node scripts/setup_abas_conhecimento.mjs
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
const { N8N_API_KEY, N8N_BASE_URL, SHEET_ID } = env;
const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// Cabeçalhos conforme docs/Esquema de Dados Bella v1.0.md
const ABAS = {
  OBRAS: ['obra_id','nome','cidade','endereco','status','recursos','observacoes'],
  PESSOAS: ['pessoa_id','nome','papel','obra_id','telefone_whatsapp','email','ativo'],
  // CONTRATOS já existe (locações) — a de compras chama CONTRATOS_COMPRAS
  CONTRATOS_COMPRAS: ['contrato_id','material','categoria_r09','fornecedor_id','preco_unitario','unidade','vigencia_inicio','vigencia_fim','pedido_minimo','frete','condicoes','obra_id','status','fonte','atualizado_em'],
  FATOS: ['fato_id','obra_id','fato','origem','confirmado_por','confirmado_em','ativo'],
  DOCUMENTOS: ['doc_id','obra_id','tipo','titulo','link','versao','atualizado_em'],
};
// Seed: só dados CONFIRMADOS (regra da casa: nunca inventar)
const SEED = { PESSOAS: [['PS-001','Daniela','COMPRADORA','','5531972249393','','TRUE']] };

const path = `prisbel-setup-abas-${randomUUID().slice(0, 8)}`;
const CRED = { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } };
const http = (name, url, jsonBody, prev) => ({
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: prev,
  parameters: {
    method: jsonBody ? 'POST' : 'GET',
    url,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleSheetsOAuth2Api',
    ...(jsonBody ? { sendBody: true, specifyBody: 'json', jsonBody: JSON.stringify(jsonBody) } : {}),
    options: {},
  },
  credentials: CRED,
});

const workflow = {
  name: `UTIL prisbel-bella — setup abas conhecimento (efêmero)`,
  settings: { executionOrder: 'v1' },
  nodes: [
    {
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: randomUUID(), // sem isso a rota não registra (pegadinha conhecida)
      parameters: { path, httpMethod: 'GET', responseMode: 'lastNode' },
    },
    http('Criar abas', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
      { requests: Object.keys(ABAS).map((title) => ({ addSheet: { properties: { title } } })) }, [220, 0]),
    http('Escrever cabecalhos', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
      { valueInputOption: 'RAW',
        data: Object.entries(ABAS).map(([title, headers]) => ({
          range: `${title}!A1`, values: [headers, ...(SEED[title] || [])],
        })) }, [440, 0]),
    http('Listar abas', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`, null, [660, 0]),
  ],
  connections: {
    Webhook: { main: [[{ node: 'Criar abas', type: 'main', index: 0 }]] },
    'Criar abas': { main: [[{ node: 'Escrever cabecalhos', type: 'main', index: 0 }]] },
    'Escrever cabecalhos': { main: [[{ node: 'Listar abas', type: 'main', index: 0 }]] },
  },
};

let id;
try {
  const created = await api('POST', '/workflows', workflow);
  id = created.id;
  console.log('workflow criado:', id);
  await api('POST', `/workflows/${id}/activate`);
  console.log('ativado; chamando webhook…');
  const res = await fetch(`${N8N_BASE_URL}/webhook/${path}`);
  const out = await res.text();
  console.log('HTTP', res.status);
  console.log(out);
} finally {
  if (id) {
    try { await api('POST', `/workflows/${id}/deactivate`); } catch {}
    try { await api('DELETE', `/workflows/${id}`); console.log('workflow utilitário apagado.'); } catch (e) { console.error('AVISO: apagar manualmente no n8n:', e.message); }
  }
}
