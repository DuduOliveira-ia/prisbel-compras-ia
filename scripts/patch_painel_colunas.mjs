// Alinha as colunas dos cards de pedido no painel (WF4): cada card tinha sua
// própria tabela com larguras automáticas — descrição longa empurrava Status/
// Pendências para posições diferentes entre cards (parecia que o campo "mudava").
// Solução: table-layout fixo + larguras fixas nas colunas de todos os cards.
// Uso: node scripts/patch_painel_colunas.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
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

const ID = '7WbHA7BoeLnrdw1Z'; // WF4 Painel
const wf = await api('GET', `/workflows/${ID}`);
const node = wf.nodes.find(n => n.name === 'Servir página');
let code = node.parameters.jsCode;

const trocas = [
  // tabela dos cards de pedido: layout fixo + larguras estáveis
  ['<table><thead><tr><th>Item</th><th style=\\"width:64px\\">Qt</th><th style=\\"width:70px\\">Un</th><th>Categoria</th><th>Status</th><th>Pendências</th><th style=\\"width:40px\\"></th></tr></thead>',
   '<table style=\\"table-layout:fixed\\"><thead><tr><th>Item</th><th style=\\"width:56px\\">Qt</th><th style=\\"width:56px\\">Un</th><th style=\\"width:190px\\">Categoria</th><th style=\\"width:110px\\">Status</th><th style=\\"width:200px\\">Pendências</th><th style=\\"width:36px\\"></th></tr></thead>'],
  // células quebram linha em vez de esticar a coluna
  ['table{width:100%;border-collapse:collapse;font-size:13px}',
   'table{width:100%;border-collapse:collapse;font-size:13px}td{overflow-wrap:break-word}'],
];
let feitas = 0;
for (const [de, para] of trocas) {
  if (code.includes(de)) { code = code.split(de).join(para); feitas++; }
  else console.log('NAO ENCONTRADO:', de.slice(0, 60));
}
if (!feitas) { console.log('nada aplicado'); process.exit(1); }
node.parameters.jsCode = code;
await api('PUT', `/workflows/${ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
await api('POST', `/workflows/${ID}/deactivate`);
await api('POST', `/workflows/${ID}/activate`);
console.log(`${feitas} troca(s) aplicada(s), bounce feito`);
