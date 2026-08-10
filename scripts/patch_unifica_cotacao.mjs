// Unifica o formato de cotação entre painel (WF4) e chat (WF7):
//  - WF4: assunto do e-mail de cotação passa a conter "Pedido N" (formato que o
//    WF5 sabe ler ao receber a resposta do fornecedor). Antes: "[PED-N] ..." —
//    cotação disparada pelo painel voltava órfã.
//  - WF5: regex do nº do pedido aceita TAMBÉM o formato antigo "PED-N"
//    (defesa para respostas de e-mails já enviados no formato velho).
// Uso: node scripts/patch_unifica_cotacao.mjs
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

const patchWorkflow = async (id, nome, trocas) => {
  const wf = await api('GET', `/workflows/${id}`);
  let feitas = 0;
  for (const node of wf.nodes) {
    if (!node.parameters || !node.parameters.jsCode) continue;
    let code = node.parameters.jsCode;
    for (const [de, para] of trocas) {
      if (code.includes(de)) { code = code.split(de).join(para); feitas++; }
    }
    node.parameters.jsCode = code;
  }
  if (!feitas) { console.log(`${nome}: NENHUMA troca aplicada — verificar strings!`); return false; }
  await api('PUT', `/workflows/${id}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
  if (wf.active) { await api('POST', `/workflows/${id}/deactivate`); await api('POST', `/workflows/${id}/activate`); }
  console.log(`${nome}: ${feitas} troca(s) aplicada(s), bounce feito`);
  return true;
};

// WF4 — assunto do painel passa a conter "Pedido N" (compatível com o WF5)
await patchWorkflow('7WbHA7BoeLnrdw1Z', 'WF4 Painel', [
  ['assunto:`[PED-${num}] Cotação ${cat}${obra?\' — obra \'+obra:\'\'}`',
   'assunto:`Cotacao - Pedido ${num} - ${cat}${obra?\' - obra \'+obra:\'\'} - Prisbel Construtora`'],
]);

// WF5 — aceita "Pedido N" E o formato antigo "PED-N"
await patchWorkflow('exEKLGtwkASI2XzD', 'WF5 Cotacoes', [
  ['pedido\\s*(?:n\\S*\\s*)?(\\d+)/i',
   '(?:pedido\\s*(?:n\\S*\\s*)?|ped-)(\\d+)/i'],
]);
