// Verificação do comparativo determinístico (bug #16): cria um pedido, injeta
// duas propostas com frete diferente e confere se a Bella aponta o vencedor certo.
// Limpa a COTACOES antes. Uso: node scripts/_verifica_comparativo.mjs
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
const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
const chat = async (t, mensagem, obra = '', historico = []) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/bella-chat-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t, obra, mensagem, historico }),
  });
  return (await r.json()).resposta;
};
const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const p = 'prisbel-temp-vcomp-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-verifica-comparativo (apagar)', settings: { executionOrder: 'v1' },
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
  const rr = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, corpo }) });
  const t = await rr.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; }
};
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;

try {
  // limpa cotacoes de testes anteriores
  await call(`${base}/values:batchClearByDataFilter`, { dataFilters: [{ a1Range: 'COTACOES!A2:N300' }] });

  // 1. pedido pelo chat do almoxarife (aceita ate 2 turnos)
  const m1 = 'Bella, pra obra Paradiso: 100 sacos de cimento CP II-32 e 12 m3 de areia lavada media. Concretagem quinta, urgente.';
  let r = await chat('pb-f21398232bf451567a', m1, 'Paradiso');
  console.log('1:', strip(r).replace(/\n/g, ' ').slice(0, 140));
  if (!/registrad/i.test(strip(r))) {
    r = await chat('pb-f21398232bf451567a', 'Isso mesmo, pode registrar', 'Paradiso',
      [{ de: 'usuario', texto: m1 }, { de: 'bella', texto: r }]);
    console.log('2:', strip(r).replace(/\n/g, ' ').slice(0, 140));
  }
  await new Promise((x) => setTimeout(x, 2500));

  // 2. numero real do pedido, lido da fila (nao do texto)
  const leitura = await call(`${base}/values:batchGetByDataFilter`, { dataFilters: [{ a1Range: 'PEDIDOS!A2:P300' }] });
  const rows = (leitura.valueRanges && leitura.valueRanges[0].valueRange.values) || [];
  let num = 0;
  for (const rr of rows) { const n = parseInt(rr[0], 10); if (n > num) num = n; }
  const itens = rows.filter((rr) => parseInt(rr[0], 10) === num);
  console.log(`\npedido ${num} na fila com ${itens.length} item(ns):`);
  for (const it of itens) console.log('   item', it[15], '|', String(it[7]).slice(0, 45), '|', it[8], it[9]);
  if (!num || itens.length < 2) throw new Error('pedido nao ficou com os 2 itens — abortando');

  // 3. duas propostas, uma com frete por fora
  const hoje = new Date().toISOString().slice(0, 10);
  const noCim = (itens.find((i) => /cimento/i.test(i[7])) || {})[15] || '1';
  const noAre = (itens.find((i) => /areia/i.test(i[7])) || {})[15] || '2';
  const linhas = [
    [num, noCim, 'cimento CP II-32', 'Constru Mais (COMUM 1)', 'btceog@gmail.com', 32, '', '3 dias uteis', 'incluso', 'faturado 28 dias', hoje, 'sim1', '', ''],
    [num, noAre, 'areia lavada media', 'Constru Mais (COMUM 1)', 'btceog@gmail.com', 145, '', '3 dias uteis', 'incluso', 'faturado 28 dias', hoje, 'sim1', '', ''],
    [num, noCim, 'cimento CP II-32', 'Obra Fácil (COMUM 2)', 'megamigosbr@gmail.com', 30.5, '', '2 dias', 'R$ 250,00 por entrega', 'pix 3% desconto', hoje, 'sim2', '', ''],
    [num, noAre, 'areia lavada media', 'Obra Fácil (COMUM 2)', 'megamigosbr@gmail.com', 138, '', '2 dias', 'R$ 250,00 por entrega', 'pix 3% desconto', hoje, 'sim2', '', ''],
  ];
  const ap = await call(`${base}/values/COTACOES!A1:append?valueInputOption=RAW`, { values: linhas });
  console.log('cotacoes injetadas:', ap.updates && ap.updates.updatedRows);

  // 4. comparativo
  await new Promise((x) => setTimeout(x, 2000));
  const comp = strip(await chat('pb-f105cf3d5ccd74c189', `Como estão as cotações do pedido ${num}? Qual a melhor opção?`));
  console.log('\n─── RESPOSTA DA BELLA ───\n' + comp);
  console.log('\n─── ESPERADO ───');
  console.log('Constru Mais: 100x32 + 12x145 = R$ 4.940,00 (frete incluso)');
  console.log('Obra Fácil:   100x30,50 + 12x138 = R$ 4.706,00 + R$ 250 = R$ 4.956,00');
  const ok = /4\.?940/.test(comp) && /4\.?956/.test(comp) && /constru\s*mais/i.test(comp);
  console.log('\n' + (ok ? '✅ totais corretos e Constru Mais apontada' : '❌ conferir acima'));
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
