// Corrige o casamento categoria-do-pedido × categoria-do-fornecedor:
// o chat grava "ACO"/"BLOCO E CERAMICA" (sem acento) e a tabela REQUISITOS/
// FORNECEDORES usa "AÇO"/"BLOCO E CERÂMICA" — a comparação era por igualdade
// exata, então TODO pedido caía no fornecedor GERAL, em silêncio.
// Passa a comparar sem acento/caixa, no WF3 (triagem por e-mail) e no WF4 (painel).
// Uso: node scripts/patch_categoria_acento.mjs
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
const patch = async (id, nome, nodeName, trocas) => {
  const wf = await api('GET', `/workflows/${id}`);
  const node = wf.nodes.find(n => n.name === nodeName);
  if (!node) throw new Error(`${nome}: nó "${nodeName}" não encontrado`);
  let code = node.parameters.jsCode, feitas = 0;
  for (const [de, para] of trocas) {
    if (!code.includes(de)) { console.log(`  ${nome}: NAO ENCONTRADO -> ${de.slice(0, 70)}`); continue; }
    code = code.split(de).join(para); feitas++;
  }
  if (!feitas) return false;
  node.parameters.jsCode = code;
  await api('PUT', `/workflows/${id}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
  if (wf.active) { await api('POST', `/workflows/${id}/deactivate`); await api('POST', `/workflows/${id}/activate`); }
  console.log(`  ${nome}: ${feitas} troca(s) + bounce`);
  return true;
};

// helper injetado nos dois lados (mesma normalização)
const NORM = "const semAc=(s)=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().trim();";

// --- WF3: seleção de fornecedores por categoria na triagem de e-mail ---
await patch('aBz2S5IDxRxNmhY6', 'WF3 Triagem', 'Processar triagem', [
  [`const porCat = {};`, `${NORM}\nconst porCat = {};`],
  [`let f = forn.filter(x => String(x['CATEGORIA']).toUpperCase() === cat);`,
   `let f = forn.filter(x => semAc(x['CATEGORIA']) === semAc(cat));`],
  [`if (!f.length) f = forn.filter(x => String(x['CATEGORIA']).toUpperCase() === 'GERAL');`,
   `if (!f.length) f = forn.filter(x => semAc(x['CATEGORIA']) === 'GERAL');`],
]);

// --- WF4: mesma seleção no painel (roda no navegador) ---
await patch('7WbHA7BoeLnrdw1Z', 'WF4 Painel', 'Servir página', [
  [`D.FORNECEDORES.rows.filter(x=>String(x.values[0]||'').toUpperCase()===cat)`,
   `D.FORNECEDORES.rows.filter(x=>semAcC(x.values[0])===semAcC(cat))`],
  [`D.FORNECEDORES.rows.filter(x=>String(x.values[0]||'').toUpperCase()==='GERAL')`,
   `D.FORNECEDORES.rows.filter(x=>semAcC(x.values[0])==='GERAL')`],
  // injeta o helper no escopo do script da página (antes da 1ª função que o usa)
  [`function toast(`, `function semAcC(s){return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().trim()}\nfunction toast(`],
]);
console.log('pronto: categoria passa a casar ignorando acento e caixa.');
