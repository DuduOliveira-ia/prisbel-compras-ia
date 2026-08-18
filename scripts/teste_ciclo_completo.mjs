// Teste do CICLO COMPLETO de compra, da chamada do almoxarife até o
// comparativo de preços entregue à Daniela:
//
//   1. Almoxarife pede material pelo chat  -> Bella registra na fila PEDIDOS
//   2. Daniela manda cotar                 -> e-mail sai para os fornecedores
//   3. Fornecedores respondem (simulado)   -> injeta resposta na caixa da Bella
//   4. WF5 lê as respostas                 -> grava na aba COTACOES + avisa Daniela
//   5. Daniela pede o comparativo no chat  -> Bella compara e recomenda
//
// Usa material de categoria EPI de propósito: é a categoria com DOIS
// fornecedores comuns (Constru Mais x Obra Facil), então existe comparativo
// de verdade. Os preços das duas respostas são cruzados (cada um ganha em um
// item) para testar se a Bella faz a conta em vez de chutar um vencedor.
//
// ATENÇÃO: escreve dados reais (1 pedido na fila) e ENVIA e-mail de verdade
// para as caixas de teste dos fornecedores. Uso:
//   node scripts/teste_ciclo_completo.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const TOK_ALMOX = 'pb-f21398232bf451567a';   // Eduardo Almoxarife (Paradiso)
const TOK_DANI = 'pb-f105cf3d5ccd74c189';    // Daniela (Compradora)

const strip = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
const chat = async (t, mensagem, obra = '', historico = []) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/bella-chat-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t, obra, mensagem, historico }),
  });
  const j = await r.json();
  return j.resposta || '';
};
const bloco = (txt, ident = '   | ') => strip(txt).split('\n')
  .filter(l => l.trim()).map(l => ident + l.trim()).join('\n');
const numDe = (txt) => (strip(txt).match(/pedido\s*(?:n\S{0,2}\s*)?(\d+)/i) || [])[1];
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const titulo = (s) => console.log(`\n${'═'.repeat(70)}\n${s}\n${'═'.repeat(70)}`);

/* ══════════ 1. ALMOXARIFE PEDE ══════════ */
titulo('1) ALMOXARIFE PEDE O MATERIAL (chat, obra Paradiso)');
const m1 = 'Bella, preciso pra obra Paradiso: 20 pares de luva de nitrilon tamanho G ' +
  'CA 38800, e 10 capacetes de seguranca branco com jugular CA 31469. E pra equipe da concretagem.';
console.log('   almoxarife>', m1);
let r1 = await chat(TOK_ALMOX, m1, 'Paradiso');
console.log('\n   BELLA:\n' + bloco(r1));

let hist = [{ de: 'usuario', texto: m1 }, { de: 'bella', texto: r1 }];
let num = numDe(r1);
if (!num) {
  console.log('\n   almoxarife> Isso mesmo, pode registrar');
  const r1b = await chat(TOK_ALMOX, 'Isso mesmo, pode registrar', 'Paradiso', hist);
  console.log('\n   BELLA:\n' + bloco(r1b));
  hist.push({ de: 'usuario', texto: 'Isso mesmo, pode registrar' }, { de: 'bella', texto: r1b });
  num = numDe(r1b);
}
if (!num) { console.error('\n[X] Bella nao registrou o pedido — teste abortado.'); process.exit(1); }
console.log(`\n   >>> PEDIDO ${num} registrado na fila`);

/* ══════════ 2. DANIELA MANDA COTAR ══════════ */
titulo(`2) DANIELA MANDA COTAR O PEDIDO ${num} (e-mail real aos fornecedores)`);
const mc = `Envia cotacao do pedido ${num} para todos os fornecedores da categoria`;
console.log('   daniela>', mc);
const c1 = await chat(TOK_DANI, mc);
console.log('\n   BELLA (proposta):\n' + bloco(c1));
console.log('\n   daniela> Pode enviar');
const c2 = await chat(TOK_DANI, 'Pode enviar', '', [
  { de: 'usuario', texto: mc }, { de: 'bella', texto: c1 },
]);
console.log('\n   BELLA (envio):\n' + bloco(c2));

/* ══════════ 3. FORNECEDORES RESPONDEM ══════════ */
titulo('3) FORNECEDORES RESPONDEM (texto livre, precos cruzados)');
// Cada fornecedor ganha em UM item: obriga a Bella a somar em vez de chutar.
const respostas = [
  { de: env.FORN_COMUM1, nome: 'Constru Mais',
    corpo: [
      'Bom dia, tudo bem?',
      '',
      'Recebemos a solicitacao de voces. Segue nossa proposta:',
      '',
      '- Luva nitrilica tamanho G (CA 38800): R$ 8,90 o par',
      '- Capacete de seguranca branco c/ jugular (CA 31469): R$ 24,50 cada',
      '',
      'Frete: R$ 80,00 por viagem.',
      'Prazo de entrega: 3 dias uteis. Pagamento 28 dias.',
      '',
      'Qualquer duvida estamos a disposicao.',
      'Constru Mais Materiais',
    ].join('\n') },
  { de: env.FORN_COMUM2, nome: 'Obra Facil',
    corpo: [
      'Ola!',
      '',
      'Seguem os valores solicitados:',
      '',
      'Luva de nitrilon G, CA 38800 --> 9,40 / par',
      'Capacete branco com jugular CA 31469 --> 21,00 / un',
      '',
      'Frete gratis para pedidos acima de R$ 300,00.',
      'Entrega em 5 dias uteis.',
      '',
      'Abracos,',
      'Obra Facil Construcao',
    ].join('\n') },
];
for (const f of respostas) {
  const out = execFileSync('node', [join(root, 'scripts', 'simula_resposta_fornecedor.mjs'),
    `--de=${f.de}`, `--nome=${f.nome}`, `--pedido=${num}`, `--corpo=${f.corpo}`],
    { encoding: 'utf8' });
  console.log(`   ${f.nome} <${f.de}>: ${out.trim()}`);
  console.log(bloco(f.corpo, '      > ') + '\n');
}

/* ══════════ 4. WF5 LÊ AS RESPOSTAS ══════════ */
titulo('4) AGUARDANDO O WF5 LER AS RESPOSTAS (poller de 1 min)');
const lerCotacoes = () => {
  const out = execFileSync('node', [join(root, 'scripts', 'ler_aba.mjs'), 'COTACOES', 'A1:M200'],
    { encoding: 'utf8' });
  return out.split('\n').filter(l => new RegExp(`^ > ${num} \\|`).test(l));
};
let linhas = [];
for (let i = 1; i <= 10; i++) {
  await espera(30000);
  try { linhas = lerCotacoes(); } catch (e) { console.log('   (leitura falhou, tentando de novo)'); continue; }
  console.log(`   [${i * 30}s] linhas do pedido ${num} na aba COTACOES: ${linhas.length}`);
  if (linhas.length >= 2) break;
}
if (!linhas.length) {
  console.error('\n[X] WF5 nao gravou nada na COTACOES — verifique se o workflow esta ativo.');
} else {
  console.log('\n   COTACOES gravadas:');
  for (const l of linhas) console.log('   ' + l.trim());
}

/* ══════════ 5. COMPARATIVO PARA A DANIELA ══════════ */
titulo(`5) DANIELA PEDE O COMPARATIVO DO PEDIDO ${num}`);
const mcomp = `Me mostra o comparativo de precos do pedido ${num}. Qual fornecedor compensa mais?`;
console.log('   daniela>', mcomp);
const comp = await chat(TOK_DANI, mcomp);
console.log('\n   BELLA:\n' + bloco(comp));

titulo(`FIM — pedido ${num}`);
console.log('Confira tambem: e-mail de aviso do WF5 na caixa da Daniela ' +
  `(${env.EMAIL_DANIELA}) e a aba COTACOES da planilha.`);
