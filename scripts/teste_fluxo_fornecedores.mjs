// Teste de fluxo com os fornecedores novos: verifica se material CONTROLADO vai
// para o fornecedor homologado e material COMUM vai para os dois concorrentes.
// Registra 2 pedidos reais e dispara cotação de verdade. Uso:
//   node scripts/teste_fluxo_fornecedores.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const TOK_ALMOX = 'pb-f21398232bf451567a';
const TOK_DANI = 'pb-f105cf3d5ccd74c189';
const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
const chat = async (t, mensagem, obra = '', historico = []) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/bella-chat-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t, obra, mensagem, historico }),
  });
  return (await r.json()).resposta;
};
const numDe = (txt) => (strip(txt).match(/pedido\s*(?:n\S{0,2}\s*)?(\d+)/i) || [])[1];

const cotar = async (num, alvo) => {
  const msg = `Envia cotação do pedido ${num} ${alvo}`;
  const p1 = await chat(TOK_DANI, msg);
  console.log('   proposta:', strip(p1).replace(/\n/g, ' ').slice(0, 190));
  const p2 = await chat(TOK_DANI, 'Pode enviar', '', [
    { de: 'usuario', texto: msg }, { de: 'bella', texto: p1 },
  ]);
  console.log('   envio:   ', strip(p2).replace(/\n/g, ' ').slice(0, 190));
};

console.log('══════ TESTE DE FLUXO — FORNECEDORES NOVOS ══════\n');

// ---- 1. material CONTROLADO (aço) ----
console.log('1) Almoxarife pede material CONTROLADO (aço)');
const m1 = 'Bella, preciso de 500 kg de vergalhão CA-50 de 12,5mm pra armação do pilar, obra Paradiso';
const r1 = await chat(TOK_ALMOX, m1, 'Paradiso');
console.log('   Bella:', strip(r1).replace(/\n/g, ' ').slice(0, 190));
let numCtrl = numDe(r1);
if (!numCtrl) {
  const r1b = await chat(TOK_ALMOX, 'Isso mesmo, pode registrar', 'Paradiso',
    [{ de: 'usuario', texto: m1 }, { de: 'bella', texto: r1 }]);
  console.log('   Bella:', strip(r1b).replace(/\n/g, ' ').slice(0, 190));
  numCtrl = numDe(r1b);
}
console.log(`   -> pedido ${numCtrl}\n`);

console.log('2) Daniela manda cotar (deve ir SÓ para o fornecedor homologado)');
await cotar(numCtrl, 'para todos os fornecedores da categoria');

// ---- 2. material COMUM (EPI) ----
console.log('\n3) Almoxarife pede material COMUM (EPI)');
const m2 = 'Preciso também de 20 pares de luva de nitrilon tamanho G, CA 38800, pra equipe da concretagem';
const r2 = await chat(TOK_ALMOX, m2, 'Paradiso');
console.log('   Bella:', strip(r2).replace(/\n/g, ' ').slice(0, 190));
let numComum = numDe(r2);
if (!numComum) {
  const r2b = await chat(TOK_ALMOX, 'Pode registrar assim', 'Paradiso',
    [{ de: 'usuario', texto: m2 }, { de: 'bella', texto: r2 }]);
  console.log('   Bella:', strip(r2b).replace(/\n/g, ' ').slice(0, 190));
  numComum = numDe(r2b);
}
console.log(`   -> pedido ${numComum}\n`);

console.log('4) Daniela manda cotar (deve ir para os DOIS concorrentes)');
await cotar(numComum, 'para todos os fornecedores');

console.log(`\n══════ pedidos criados: ${numCtrl} (controlado) e ${numComum} (comum) ══════`);
