// Responde as cotações de um pedido pelos fornecedores, SEM abrir caixa de
// e-mail nenhuma. Usa o harness de injeção (gmail messages.insert): a mensagem
// entra na caixa da Bella com o From do fornecedor — que é como o WF5 identifica
// quem respondeu. Ninguém recebe e-mail de verdade.
//
// Feito para a APRESENTAÇÃO: em vez de abrir 3 Gmails e explicar que "btceog é
// a loja de material comum", roda-se um comando e as propostas chegam sozinhas.
//
// Uso:
//   node scripts/responder_cotacoes.mjs --pedido=1
//   node scripts/responder_cotacoes.mjs --pedido=1 --intervalo=45   (segundos)
//   node scripts/responder_cotacoes.mjs --pedido=1 --so=comum1      (um fornecedor só)
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
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const pedido = arg('pedido');
const intervalo = parseInt(arg('intervalo', '20'), 10);
const so = (arg('so', '') || '').toLowerCase();
if (!pedido) {
  console.error('Informe o pedido: node scripts/responder_cotacoes.mjs --pedido=1');
  process.exit(1);
}

// As propostas do roteiro. A pegadinha do frete mora aqui: a Obra Fácil tem o
// menor preço unitário e o maior total, porque cobra frete por fora.
const PROPOSTAS = [
  { chave: 'controlado', de: env.FORN_CONTROLADO || 'recrutai.sap@gmail.com', nome: 'Aço Forte',
    corpo: [
      'Bom dia!', '',
      'Segue nossa proposta para o Pedido ' + pedido + ':', '',
      '- Cimento CP II-32: R$ 32,00 o saco - 100 sacos = R$ 3.200,00',
      '- Areia lavada media: R$ 145,00 o m3 - 12 m3 = R$ 1.740,00', '',
      'Frete incluso para Nova Lima. Prazo de entrega: 3 dias uteis.',
      'Pagamento: faturado 28 dias.', '',
      'Atenciosamente,', 'Aco Forte',
    ].join('\n') },
  { chave: 'comum1', de: env.FORN_COMUM1 || 'btceog@gmail.com', nome: 'Constru Mais',
    corpo: [
      'Bom dia!', '',
      'Nossa proposta para o Pedido ' + pedido + ':', '',
      '- Lona preta 200 micras: R$ 68,00 o rolo - 4 rolos = R$ 272,00', '',
      'Frete incluso. Entrega em 3 dias uteis.',
      'Pagamento faturado 28 dias.', '',
      'Atenciosamente,', 'Constru Mais',
    ].join('\n') },
  { chave: 'comum2', de: env.FORN_COMUM2 || 'megamigosbr@gmail.com', nome: 'Obra Facil',
    corpo: [
      'Opa, bom dia!', '',
      'A lona preta de 200 micras eu faco a R$ 62,00 o rolo. Os 4 rolos dao R$ 248,00.', '',
      'So que o frete pra Nova Lima e por fora: R$ 40,00 por entrega.', '',
      'Entrego amanha mesmo. A vista no pix dou 3% de desconto.', '',
      'Abraco,', 'Obra Facil',
    ].join('\n') },
];

const alvos = so ? PROPOSTAS.filter((p) => p.chave === so) : PROPOSTAS;
if (!alvos.length) {
  console.error('--so aceita: controlado, comum1, comum2');
  process.exit(1);
}
console.log(`respondendo o pedido ${pedido} por ${alvos.length} fornecedor(es), ${intervalo}s entre cada\n`);

for (let i = 0; i < alvos.length; i++) {
  const p = alvos[i];
  const saida = execFileSync(process.execPath, [
    join(root, 'scripts', 'simula_resposta_fornecedor.mjs'),
    `--de=${p.de}`, `--pedido=${pedido}`, `--corpo=${p.corpo}`,
  ], { cwd: root, encoding: 'utf8' });
  console.log(`  ${p.nome} <${p.de}> respondeu`);
  process.stdout.write(saida.split('\n').filter(Boolean).map((l) => '     ' + l).join('\n') + '\n');
  if (i < alvos.length - 1) {
    // espaçar mantém o teste legível: cada resposta vira um aviso separado à compradora
    await new Promise((x) => setTimeout(x, intervalo * 1000));
  }
}
console.log('\nPronto. Em ate 1 minuto a Bella lê e lança na planilha.');
console.log('Depois pergunte no chat: "Como estao as cotacoes do pedido ' + pedido + '?"');
