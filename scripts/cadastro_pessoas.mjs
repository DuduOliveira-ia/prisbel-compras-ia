// Cadastro básico da aba PESSOAS para os testes:
//  - normaliza o cabeçalho da coluna H ("Atividade" -> "atividade", padrão snake_case
//    das abas de conhecimento) e acrescenta "pode_solicitar" (I)
//  - preenche o e-mail da Daniela (agora conhecido) e cadastra o elenco do processo
// Nada é sobrescrito além do cabeçalho e do e-mail da linha da Daniela.
// Uso: node scripts/cadastro_pessoas.mjs [--dry]
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
const dry = process.argv.includes('--dry');
const EMAIL_DANIELA = env.EMAIL_DANIELA || 'suprimentosmunizerabelo@gmail.com';

// elenco do processo de compras (papéis já em uso no sistema)
const NOVAS = [
  ['PS-002', 'Eduardo Almoxarife', 'ALMOXARIFE', 'Paradiso', '', 'mentoriawiki@gmail.com', 'TRUE',
   'Requisitante da obra: abre o pedido de material com quantidade e especificacao, responde as pendencias cobradas pela Bella e confere a entrega no canteiro',
   'SIM'],
  ['PS-003', 'Luís Eduardo', 'GESTOR', '', '', '', 'TRUE',
   'Gestor de obras: acompanha os pedidos de todas as obras, prioriza urgencias e aprova excecoes',
   'SIM'],
  ['PS-004', 'Bella', 'IA', '', '5531973452353', 'ssysbot@gmail.com', 'TRUE',
   'Assistente de IA: recebe as solicitacoes por chat/voz/e-mail/WhatsApp, confere especificacoes, cobra o que falta, registra na fila, envia cotacao apos aprovacao da compradora e monta o comparativo',
   'NAO'],
];

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const path = 'prisbel-temp-pessoas-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-pessoas (apagar)', settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'W', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: 'POST', path, responseMode: 'lastNode' } },
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
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, corpo }),
  });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

try {
  const leitura = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchGetByDataFilter`,
    { dataFilters: [{ a1Range: 'PESSOAS!A1:I50' }] });
  const rows = (leitura.valueRanges && leitura.valueRanges[0].valueRange.values) || [];
  console.log('linhas atuais:', rows.length);
  const existentes = new Set(rows.slice(1).map(r => String(r[1] || '').trim().toLowerCase()));
  const aAdicionar = NOVAS.filter(n => !existentes.has(n[1].toLowerCase()));
  console.log('a cadastrar:', aAdicionar.map(n => n[1]).join(', ') || '(nenhum — já existem)');

  if (dry) { console.log('DRY RUN — nada alterado.'); }
  else {
    // 1. cabeçalho padronizado + coluna pode_solicitar
    // ATENÇÃO: values:batchUpdateByDataFilter falha em SILÊNCIO neste ambiente
    // (nem erro, nem escrita). Usar values:batchUpdate com range A1.
    const up = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchUpdate`, {
      valueInputOption: 'RAW',
      data: [
        { range: 'PESSOAS!H1:I1', values: [['atividade', 'pode_solicitar']] },
        // e-mail da Daniela (linha 2) e marcação de que ela solicita/aprova
        { range: 'PESSOAS!F2', values: [[EMAIL_DANIELA]] },
        { range: 'PESSOAS!I2', values: [['SIM']] },
      ],
    });
    if (up.error) throw new Error(up.error.message);
    console.log('cabecalho/e-mail:', up.totalUpdatedCells, 'celula(s)');
    // 2. elenco
    if (aAdicionar.length) {
      const ap = await call(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/PESSOAS!A1:append?valueInputOption=RAW`,
        { values: aAdicionar });
      if (ap.error) throw new Error(ap.error.message);
      console.log('cadastrados:', ap.updates.updatedRows, 'linha(s)');
    }
    console.log('PESSOAS atualizada.');
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
