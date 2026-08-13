// Cria/atualiza a aba MATERIAIS na planilha da Bella: um registro por GRUPO real
// de compra (distinct do histórico da PLANILHA COMPRAS 2026), com NBR extraída dos
// próprios descritivos, proposta de CONTROLADO e os campos obrigatórios de validação.
// A aba é uma PROPOSTA para a Daniela validar — a REQUISITOS (usada em produção)
// não é tocada até a validação. Uso: node scripts/criar_aba_materiais.mjs
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

// --- lê o distinct gerado do histórico ---
const csv = readFileSync(join(root, 'knowledge', 'lista-materiais-2026.csv'), 'utf8');
const parseLinha = (l) => {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
};
const linhas = csv.split(/\r?\n/).filter(Boolean).slice(1).map(parseLinha);

// --- de-para: grupo real de compra -> categoria da REQUISITOS (produção) ---
const PARA_CATEGORIA = {
  'AÇO': 'AÇO', 'CIMENTICIOS': 'CIMENTO E ARGAMASSA', 'BLOCO CONCRETO': 'BLOCO E CERÂMICA',
  'BLOCO CERAMICO': 'BLOCO E CERÂMICA', 'ELETRICO': 'MATERIAL ELÉTRICO', 'HIDRAULICO': 'HIDRÁULICA',
  'SEGURANÇA': 'EPI', 'LIMPEZA': 'LIMPEZA', 'MATERIAL ESCRITORIO': 'ADMIN', 'UNIFORME': 'EPI',
  'AGREGADOS': 'AGREGADOS (criar)', 'MADEIRAS': 'MADEIRAS (criar)', 'PINTURA': 'PINTURA (criar)',
  'GESSO': 'GESSO (criar)', 'REVESTIMENTO': 'REVESTIMENTO (criar)',
  'IMPERMEABILIZANTES': 'IMPERMEABILIZACAO (criar)', 'CONCRETO': 'CONCRETO USINADO (criar)',
  'PRE MOLDADOS': 'PRE MOLDADOS (criar)', 'INCENDIO': 'INCENDIO (criar)', 'GAS': 'GAS (criar)',
  'FERRAMENTAS': 'GERAL', 'CANTEIRO DE OBRAS': 'GERAL', 'PAISAGISMO': 'GERAL',
  'ALIMENTAÇAO': 'ADMIN', 'SERVIÇOS': '— (serviço, não é material)', 'SEM GRUPO': 'GERAL',
};
// campos mínimos de validação por categoria (calibração de obra já usada pela Bella)
const CAMPOS = {
  'AÇO': 'tipo (CA-50/CA-60); bitola; quantidade em kg',
  'CIMENTO E ARGAMASSA': 'tipo (CP II/III/IV/V ou AC1/AC2/AC3); classe; quantidade em sacos',
  'BLOCO E CERÂMICA': 'dimensões CxLxA; estrutural ou vedação; MPa se estrutural; quantidade',
  'MATERIAL ELÉTRICO': 'bitola/amperagem; tipo (sobrepor/embutir); marca quando de projeto',
  'HIDRÁULICA': 'bitola/polegada; tipo (soldável/roscável); quantidade',
  'EPI': 'tipo; tamanho; CA (certificado de aprovação); quantidade',
  'LIMPEZA': 'tipo; volume/tamanho; quantidade',
  'ADMIN': 'descrição; quantidade',
  'AGREGADOS (criar)': 'tipo (areia lavada/média, brita nº); quantidade em m³ ou caminhão',
  'MADEIRAS (criar)': 'espécie/tipo; bitola das peças; comprimento; quantidade',
  'PINTURA (criar)': 'tipo (PVA/acrílica/esmalte); linha; cor; acabamento; embalagem',
  'GESSO (criar)': 'tipo (lento/rápido ou placa/chapa RU); dimensões; quantidade',
  'REVESTIMENTO (criar)': 'linha/modelo; dimensões; acabamento (NAT/POL/RET); m² e ambiente',
  'IMPERMEABILIZACAO (criar)': 'tipo (manta/argamassa polimérica); espessura; área em m²',
  'CONCRETO USINADO (criar)': 'fck; brita; slump; lançamento (convencional/bombeável); m³',
  'PRE MOLDADOS (criar)': 'peça; dimensões; resistência; quantidade',
  'INCENDIO (criar)': 'tipo; capacidade/classe; certificação; quantidade',
  'GAS (criar)': 'bitola; tipo de tubo/conexão; quantidade',
  'GERAL': 'descrição clara; quantidade; unidade',
};

const cab = ['grupo_compra', 'itens_distintos', 'compras', 'unidades', 'nbr_do_historico',
  'CONTROLADO (proposto)', 'base da proposta', 'categoria_bella', 'campos_obrigatorios (validação do pedido)',
  'exemplos_do_historico', 'VALIDADO POR (Daniela)'];

const dados = linhas.map((l) => {
  const [grupo, itens, compras, unidades, nbr, exemplos] = l;
  const cat = PARA_CATEGORIA[grupo] || 'GERAL';
  const servico = /SERVI/.test(grupo);
  const controlado = servico ? '—' : (nbr ? 'SIM' : 'NÃO');
  const base = servico ? 'serviço: não passa por cotação de material'
    : (nbr ? 'norma citada nas próprias compras do histórico' : 'nenhuma norma citada no histórico');
  return [grupo, itens, compras, unidades, nbr || '', controlado, base, cat,
    CAMPOS[cat] || CAMPOS['GERAL'], exemplos, ''];
});

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
const p = 'prisbel-temp-mat-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-materiais (apagar)', settings: { executionOrder: 'v1' },
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
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, corpo }) });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;
try {
  const add = await call(`${base}:batchUpdate`, { requests: [{ addSheet: { properties: { title: 'MATERIAIS' } } }] });
  if (add.error && !/already exists/i.test(add.error.message || '')) throw new Error(add.error.message);
  await call(`${base}/values:batchClearByDataFilter`, { dataFilters: [{ a1Range: 'MATERIAIS!A1:K80' }] });
  const up = await call(`${base}/values:batchUpdate`,
    { valueInputOption: 'RAW', data: [{ range: 'MATERIAIS!A1', values: [cab, ...dados] }] });
  if (up.error) throw new Error(up.error.message);
  console.log(`aba MATERIAIS: ${dados.length} grupos, ${up.totalUpdatedCells} células`);
  const ctrl = dados.filter(d => d[5] === 'SIM').length;
  console.log(`propostos CONTROLADO: ${ctrl} | não controlado: ${dados.filter(d => d[5] === 'NÃO').length} | serviços: ${dados.filter(d => d[5] === '—').length}`);
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
