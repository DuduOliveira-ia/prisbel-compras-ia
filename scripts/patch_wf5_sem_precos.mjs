// WF5: resposta de fornecedor SEM nenhum preço reconhecível não é lançada na
// COTACOES (evita linhas vazias que sujam o comparativo). Em vez disso, a
// Daniela recebe aviso para olhar o e-mail manualmente. Caso real que motivou:
// auto-resposta de um agente de IA na caixa do fornecedor de teste (10/08).
// Uso: node scripts/patch_wf5_sem_precos.mjs
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

const ID = 'exEKLGtwkASI2XzD';
const wf = await api('GET', `/workflows/${ID}`);

const proc = wf.nodes.find(n => n.name === 'Processar');
proc.parameters.jsCode = `const ctx = $('Montar').first().json;
let dados = { itens: [], condicoes_gerais: '' };
try { dados = JSON.parse($json.candidates[0].content.parts[0].text); } catch (e) {}
const hoje = new Date().toISOString().slice(0, 10);
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '' : Number(v);
// so entram itens com ALGUM preco; resposta sem preco nenhum nao e cotacao
const comPreco = (Array.isArray(dados.itens) ? dados.itens.slice(0, 40) : [])
  .filter(i => num(i.preco_unit) !== '' || num(i.preco_total) !== '');
const values = comPreco.map(i => [
  ctx.pedido, String(i.item_no ?? 0), String(i.descricao || '').slice(0, 200), ctx.fornecedor, ctx.remetente,
  num(i.preco_unit), num(i.preco_total), String(i.prazo || '').slice(0, 60), String(i.frete || '').slice(0, 60),
  String(dados.condicoes_gerais || '').slice(0, 200), hoje, ctx.email_id, '', String(i.obs || '').slice(0, 200),
]);
const semPrecos = !values.length;
return [{ json: { n: values.length, semPrecos,
  url: "https://sheets.googleapis.com/v4/spreadsheets/1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8" + '/values/COTACOES!A1:append?valueInputOption=RAW',
  corpo: { values } } }];
`;

const aviso = wf.nodes.find(n => n.name === 'Preparar aviso');
aviso.parameters.jsCode = `const ctx = $('Montar').first().json;
const p = $('Processar').first().json;
let corpo;
if (p.semPrecos) {
  corpo = 'Oi, Daniela!\\n\\nO fornecedor ' + ctx.fornecedor + ' respondeu o e-mail da cotacao do pedido ' + (ctx.pedido || '?') +
    ', mas NAO consegui reconhecer precos na resposta. Nao lancei nada na planilha.\\n' +
    'Vale abrir o e-mail dele na caixa da Bella e verificar manualmente.\\n\\n' +
    'Bella — Assistente de Compras | Prisbel Construtora';
} else {
  corpo = 'Oi, Daniela!\\n\\nChegou resposta de cotacao:\\n' +
    'Fornecedor: ' + ctx.fornecedor + '\\nPedido: ' + (ctx.pedido || '?') + '\\nItens reconhecidos: ' + p.n +
    '\\n\\nJa lancei tudo na aba COTACOES. Voce pode ver o comparativo me perguntando no chat: ' +
    'como estao as cotacoes do pedido ' + (ctx.pedido || '') + '?\\n\\n' +
    'Bella — Assistente de Compras | Prisbel Construtora';
}
return [{ json: { para: "oliveirae.ti@gmail.com",
  assuntoAviso: (p.semPrecos ? 'Resposta SEM precos — Pedido ' : 'Cotacao recebida — Pedido ') + (ctx.pedido || '?') + ' (' + ctx.fornecedor + ')', corpo } }];
`;

// IF entre Processar e Gravar: sem precos pula a gravacao e vai direto ao aviso
wf.nodes.push({
  name: 'Tem precos?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1060, 300],
  parameters: { conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    combinator: 'and',
    conditions: [{ id: 'c-precos', leftValue: "={{ $json.semPrecos ? 'nao' : 'sim' }}", rightValue: 'sim',
      operator: { type: 'string', operation: 'equals' } }],
  } },
});
wf.connections['Processar'] = { main: [[{ node: 'Tem precos?', type: 'main', index: 0 }]] };
wf.connections['Tem precos?'] = { main: [
  [{ node: 'Gravar COTACOES', type: 'main', index: 0 }],
  [{ node: 'Preparar aviso', type: 'main', index: 0 }],
] };

await api('PUT', `/workflows/${ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
await api('POST', `/workflows/${ID}/deactivate`);
await api('POST', `/workflows/${ID}/activate`);
console.log('WF5 atualizado: resposta sem precos nao grava, aviso proprio; bounce feito');
