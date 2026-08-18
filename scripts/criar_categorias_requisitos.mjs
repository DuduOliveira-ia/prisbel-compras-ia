// Cria na REQUISITOS (produção) as 10 categorias que a aba MATERIAIS já tinha
// mapeado como "(criar)" e que a Daniela validou como CONTROLADO=SIM (xlsx
// devolvido 17/08, aba "Grupos (resumo)"): PINTURA, REVESTIMENTO, GESSO,
// MADEIRAS, IMPERMEABILIZAÇÃO, AGREGADOS, INCÊNDIO, PRÉ-MOLDADOS, GÁS,
// CONCRETO USINADO — 357 grupos de material que hoje caem no fallback GERAL
// na triagem (WF3) e no chat (WF7), sem os campos obrigatórios específicos.
// CAMPOS OBRIGATÓRIOS vêm da calibração já usada em MATERIAIS!I (mesma
// coluna que a Daniela viu ao validar). PALAVRAS-CHAVE e EXEMPLO COMPLETO
// foram montados a partir do histórico real (knowledge/referencia-precos-2026.csv).
// Uso: node scripts/criar_categorias_requisitos.mjs
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

const NOVAS = [
  ['PINTURA', 'tinta, esmalte, verniz, textura, massa corrida, selador, fundo preparador',
    'tipo (PVA/acrílica/esmalte); linha; cor; acabamento; embalagem',
    'Tinta acrílica Suvinil fosco branco 18L — 3 latas', 'SIM'],
  ['REVESTIMENTO', 'porcelanato, piso, revestimento, rodapé, azulejo, granito, mármore',
    'linha/modelo; dimensões; acabamento (NAT/POL/RET); m² e ambiente',
    'Porcelanato 60x120 NAT RET — 60m² para a área da piscina', 'SIM'],
  ['GESSO', 'gesso, drywall, placa de gesso, perfil, montante, guia, steel frame',
    'tipo (lento/rápido ou placa/chapa RU); dimensões; quantidade',
    'Placa de gesso ST 1,20x1,80m — 20 unidades', 'SIM'],
  ['MADEIRAS', 'madeira, pontalete, tábua, sarrafo, madeirite, viga, prancha',
    'espécie/tipo; bitola das peças; comprimento; quantidade',
    'Pontalete de pinus 7x7cm x 3m — 50 unidades', 'SIM'],
  ['IMPERMEABILIZAÇÃO', 'manta asfáltica, impermeabilizante, vedacit, sika, viaplus, selante',
    'tipo (manta/argamassa polimérica); espessura; área em m²',
    'Manta asfáltica 4mm — 100m² para laje de cobertura', 'SIM'],
  ['AGREGADOS', 'areia, brita, pedra britada, bica corrida, pedrisco',
    'tipo (areia lavada/média, brita nº); quantidade em m³ ou caminhão',
    'Areia lavada — 10m³', 'SIM'],
  ['INCÊNDIO', 'extintor, mangueira de incêndio, porta corta-fogo, hidrante, PCF',
    'tipo; capacidade/classe; certificação; quantidade',
    'Extintor PQS ABC 6kg CA vigente — 4 unidades', 'SIM'],
  ['PRÉ-MOLDADOS', 'pré-moldado, tubo de concreto, caixa de passagem, ladrilho hidráulico, chapéu de muro',
    'peça; dimensões; resistência; quantidade',
    'Tubo de concreto PA1 DN 600 x 2m — 10 unidades', 'SIM'],
  ['GÁS', 'gás, tubo de gás, registro de gás, caixa de medidor',
    'bitola; tipo de tubo/conexão; quantidade',
    "Tubo luva gás 1'' — 20 metros", 'SIM'],
  ['CONCRETO USINADO', 'concreto usinado, concreto bombeado, fck, concretagem',
    'fck; brita; slump; lançamento (convencional/bombeável); m³',
    'Concreto usinado fck 25MPa bombeável — 15m³', 'SIM'],
];

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-reqcat-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-reqcat (apagar)', settings: { executionOrder: 'v1' },
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
  const antes = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: 'REQUISITOS!A2:A50' }] });
  const existentes = ((antes.valueRanges && antes.valueRanges[0].valueRange.values) || []).map(r => r[0]);
  const dup = NOVAS.filter(n => existentes.includes(n[0]));
  if (dup.length) throw new Error('categoria já existe em REQUISITOS: ' + dup.map(d => d[0]).join(', '));

  const ap = await call(`${base}/values/REQUISITOS!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: NOVAS });
  if (ap.error) throw new Error(ap.error.message);
  const cel = ap.updates ? ap.updates.updatedCells : '?';
  console.log(`REQUISITOS: ${NOVAS.length} categorias novas, ${cel} células (range ${ap.updates && ap.updates.updatedRange})`);
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
