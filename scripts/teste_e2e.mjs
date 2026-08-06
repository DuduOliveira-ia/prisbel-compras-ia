// Bateria E2E da Bella — roda o fluxo completo do simulado + regressões.
// Uso: node scripts/teste_e2e.mjs
// ATENÇÃO: escreve dados reais de teste (registra 1 pedido na fila PEDIDOS).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const { N8N_BASE_URL, BELLA_CHAT_TOKEN, BELLA_ADMIN_TOKEN } = env;
const TOK_ALMOX = 'pb-f21398232bf451567a';   // Eduardo Almoxarife (Paradiso)
const TOK_DANI = 'pb-f105cf3d5ccd74c189';    // Daniela (Compradora)

const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
const chat = async (t, mensagem, obra, historico = []) => {
  const r = await fetch(`${N8N_BASE_URL}/webhook/bella-chat-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t, obra, mensagem, historico }),
  });
  return r.json();
};
const admin = async (acao, extra = {}) => {
  const r = await fetch(`${N8N_BASE_URL}/webhook/bella-admin-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ t: BELLA_ADMIN_TOKEN, acao }, extra)),
  });
  return r.json();
};

let passa = 0, falha = 0;
const teste = (nome, cond, detalhe = '') => {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : '  →  ' + detalhe}`);
  ok ? passa++ : falha++;
};

console.log('════════ BATERIA E2E BELLA ════════\n');

/* ---- 0. saúde ---- */
const farol = await admin('farol');
teste('0.1 farol responde', farol.ok);
teste('0.2 Google OAuth conectado', farol.google_ok, 'RECONECTAR credenciais no n8n antes do simulado!');
const pedidosAntes = farol.pedidos;
console.log(`     (pedidos na fila antes: ${pedidosAntes})\n`);

/* ---- 1. páginas e acessos ---- */
const pgA = await (await fetch(`${N8N_BASE_URL}/webhook/bella-chat?t=${TOK_ALMOX}`)).text();
teste('1.1 página almoxarife personalizada', pgA.includes('"papel":"ALMOXARIFE"'));
teste('1.2 obra travada no cliente', pgA.includes("USER.papel === 'ALMOXARIFE'"));
const pgD = await (await fetch(`${N8N_BASE_URL}/webhook/bella-chat?t=${TOK_DANI}`)).text();
teste('1.3 página Daniela personalizada', pgD.includes('"nome":"Daniela"'));
const pgX = await (await fetch(`${N8N_BASE_URL}/webhook/bella-chat?t=pb-inexistente99`)).text();
teste('1.4 token inválido bloqueado', pgX.includes('expirado'));
const apiX = await chat('pb-inexistente99', 'oi', '');
teste('1.5 API nega token inválido', String(apiX.resposta).includes('expirou'));

/* ---- 2. fluxo do simulado: almoxarife pede ---- */
console.log('\n— Passo 1: almoxarife pede material —');
const m1 = 'Ô Bella, manda 50 sacos de cimento e um rolo de lona preta pra cobrir a laje';
const r1 = await chat(TOK_ALMOX, m1, 'Paradiso');
const t1 = strip(r1.resposta);
teste('2.1 pergunta tipo do cimento', /CP\s*I/i.test(t1), t1.slice(0, 120));
teste('2.2 pergunta micragem da lona', /micra/i.test(t1), t1.slice(0, 120));
teste('2.3 NÃO registrou ainda (incompleto)', !/registrad/i.test(t1) && !r1.conversa_id === false && !/pedido n/i.test(t1.toLowerCase().replace('pedido pra', '')), t1.slice(0, 150));

const hist = [{ de: 'usuario', texto: m1 }, { de: 'bella', texto: r1.resposta }];
const m2 = 'Cimento CP II-32 e a lona é de 200 micras';
const r2 = await chat(TOK_ALMOX, m2, 'Paradiso', hist);
const t2 = strip(r2.resposta);
const numMatch = t2.match(/pedido\s*(?:n\S{0,2}\s*)?(\d+)/i);
teste('2.4 registrou o pedido com número', !!numMatch, t2.slice(0, 200));
const numNovo = numMatch ? numMatch[1] : '?';
console.log(`     (pedido registrado: nº ${numNovo})`);
teste('2.5 resposta menciona Daniela', /daniela/i.test(t2), t2.slice(0, 200));

/* ---- 3. o pedido aparece para a Daniela ---- */
console.log('\n— Passo 2: Daniela enxerga —');
await new Promise((x) => setTimeout(x, 3000));
const farol2 = await admin('farol');
teste('3.1 fila PEDIDOS cresceu', farol2.pedidos > pedidosAntes, `antes=${pedidosAntes} depois=${farol2.pedidos}`);
const r3 = await chat(TOK_DANI, `Como está o pedido ${numNovo}?`, '');
const t3 = strip(r3.resposta);
teste('3.2 Daniela vê o pedido novo', new RegExp(`(cimento|lona)`, 'i').test(t3), t3.slice(0, 200));
teste('3.3 itens com specs preservadas', /CP II-32/i.test(t3) && /200/.test(t3), t3.slice(0, 250));

/* ---- 4. anti-duplicação: pedir status não re-registra ---- */
const hist4 = [...hist, { de: 'usuario', texto: m2 }, { de: 'bella', texto: r2.resposta }];
const r4 = await chat(TOK_ALMOX, 'Obrigado! Tá certo assim?', 'Paradiso', hist4);
const t4 = strip(r4.resposta);
const farol3 = await admin('farol');
teste('4.1 conversa pós-registro não duplica pedido', farol3.pedidos === farol2.pedidos, `ficou ${farol3.pedidos}, era ${farol2.pedidos}: "${t4.slice(0, 120)}"`);

/* ---- 5. trava de obra do almoxarife (spoof) ---- */
const r5 = await chat(TOK_ALMOX, 'Em qual obra esse meu pedido é lançado?', 'UPTOWN');
teste('5.1 spoof de obra neutralizado', /paradiso/i.test(strip(r5.resposta)), strip(r5.resposta).slice(0, 150));

/* ---- 6. cotação em 2 etapas (Daniela) ---- */
console.log('\n— Cotação —');
const c1 = await chat(TOK_DANI, `Envia cotação do pedido ${numNovo} para o Fornecedor Geral Teste`, '');
const tc1 = strip(c1.resposta);
teste('6.1 propõe sem enviar', !/enviada para/i.test(tc1) && /(enviar|confirm)/i.test(tc1), tc1.slice(0, 180));
const histC = [{ de: 'usuario', texto: `Envia cotação do pedido ${numNovo} para o Fornecedor Geral Teste` }, { de: 'bella', texto: c1.resposta }];
const c2 = await chat(TOK_DANI, 'Pode enviar', '', histC);
const tc2 = strip(c2.resposta);
teste('6.2 envia após confirmação', /enviada/i.test(tc2), tc2.slice(0, 180));

/* ---- 7. conhecimento e guardas ---- */
console.log('\n— Conhecimento e guardas —');
const k1 = await chat(TOK_DANI, 'Qual o acabamento elétrico do memorial do UPTOWN?', 'UPTOWN');
teste('7.1 memorial UPTOWN (Simon 35)', /simon/i.test(strip(k1.resposta)), strip(k1.resposta).slice(0, 150));
const k2 = await chat(TOK_DANI, 'Qual o acabamento elétrico do memorial?', 'Paradiso');
teste('7.2 Paradiso sem memorial → não inventa', !/simon/i.test(strip(k2.resposta)), strip(k2.resposta).slice(0, 150));
const k3 = await chat(TOK_DANI, 'Quanto sai 2 toneladas de vergalhão CA50 12,5mm?', '');
teste('7.3 pré-orçamento com mediana', /R\$/.test(strip(k3.resposta)) && /10\.?4|5,2/i.test(strip(k3.resposta)), strip(k3.resposta).slice(0, 200));
const k4 = await chat(TOK_ALMOX, 'Quem ganhou o jogo ontem?', '');
teste('7.4 fora de escopo recusado', /compra/i.test(strip(k4.resposta)), strip(k4.resposta).slice(0, 120));

/* ---- resumo ---- */
console.log(`\n════════ RESULTADO: ${passa} ✅  ${falha} ❌ ════════`);
process.exit(falha ? 1 : 0);
