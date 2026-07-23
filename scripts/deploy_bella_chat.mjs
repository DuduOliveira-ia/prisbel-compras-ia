// Publica/atualiza o WF7 - Bella Chat no n8n:
//   GET  /webhook/bella-chat      → página (painel/bella-chat-v0.2.html)
//   POST /webhook/bella-chat-api  → Bella ao vivo: abas da planilha + Gemini
// Uso: node scripts/deploy_bella_chat.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
let envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
if (!env.BELLA_CHAT_TOKEN) {
  env.BELLA_CHAT_TOKEN = 'pb-bella-' + randomBytes(6).toString('hex');
  envText += (envText.endsWith('\n') ? '' : '\n') + `BELLA_CHAT_TOKEN=${env.BELLA_CHAT_TOKEN}\n`;
  writeFileSync(envPath, envText);
}
const { N8N_API_KEY, N8N_BASE_URL, SHEET_ID, BELLA_CHAT_TOKEN } = env;

const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

/* ---------------- página ---------------- */
const page = '<!DOCTYPE html>\n<html lang="pt-BR">\n<meta charset="utf-8">\n' +
  readFileSync(join(root, 'painel', 'bella-chat-v0.3.html'), 'utf8') + '\n</html>';
const NEGADO_HTML = '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Bella</title>' +
  '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
  '<p>Link inválido ou incompleto. Confira o endereço com o Eduardo.</p></body></html>';
const jsServe =
  `const token = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const ok = ($json.query || {}).t === token;\n` +
  `const html = ok ? ${JSON.stringify(page)} : ${JSON.stringify(NEGADO_HTML)};\n` +
  `return [{ json: { html } }];\n`;

/* ---------------- prompt da Bella (camada 1) ---------------- */
const R09 =
`ACO: tipo (CA-50/CA-60), bitola, qtd em kg
AREIA: tipo (lavada/comum), granulometria (fina/media/grossa), qtd em tonelada (ou caminhao combinado)
ARGAMASSA COLANTE: tipo (AC1/AC2/AC3 ou especial), qtd
ARGAMASSAS (assentamento/impermeabilizacao/rejunte/graute): tipo pelo uso, qtd
BLOCO CERAMICO ou CONCRETO: dimensoes CxLxA, tipo (estrutural/vedacao), MPa SO se estrutural, qtd
BRITA: numero (0/1/2...), qtd em m3
CAL: tipo (CH-I/II/III), qtd kg. GESSO: lento/rapido, saco 1/20/40kg
CHAPA GESSO: acartonado comum ou RU verde, dimensoes
CIMENTO: tipo (CP I a V) e classe (25/32/40), qtd em sacos
CONCRETO USINADO: fck, brita, slump, lancamento (convencional/bombeavel), m3
ESQUADRIA/JANELA/PORTA: funcionamento, folha, lado abertura, material, dimensoes, acabamento
LONA: espessura em micras, largura do rolo se souber
LOUCA SANITARIA: tipo (bacia caixa acoplada etc), cor, linha/marca
MADEIRA: especie, tipo/bitola das pecas, comprimento; compensado: resinado/plastificado + espessura
ELETRICA/HIDRAULICA/GAS: conforme projeto — bitola, cor do fio, amperagem, marca; se nao souber, confirmar com projeto
METAL SANITARIO: tipo (torneira/registro/valvula), bitola, acabamento, marca
PISOS/REVESTIMENTOS: tipo, dimensoes, cor, qualidade (extra/primeira), marca
TELHA: ceramica (modelo+cor) ou fibrocimento (dimensoes+espessura)
TINTA: tipo (PVA/acrilica/esmalte), linha, cor, acabamento, embalagem
VIDRO: tipo, espessura, cor, medidas, instalado ou nao
EPI (luvas/botas/capacetes): tipo, tamanho, CA quando aplicavel, qtd`;

const SYSTEM = `Voce e a Bella, assistente de compras da Prisbel Construtora. Fale portugues do Brasil, tom simpatico, direto e pratico, linguagem simples de obra. Respostas CURTAS (2 a 6 linhas), estilo WhatsApp. Formate SOMENTE com as tags HTML <b>, <ul><li> e <br>. NUNCA use markdown (nada de asteriscos, hifens de lista ou cerquilhas).

REGRAS DE OURO:
1. NUNCA invente dado nenhum (preco, contrato, prazo, estoque, especificacao de projeto). O que nao estiver nos DADOS abaixo voce NAO sabe: diga que nao encontrou e pergunte, ou diga que vai verificar com a Daniela (compradora).
2. Pedido de material: confira os campos obrigatorios da categoria (tabela REQUISITOS abaixo). Se faltar algo, pergunte de forma dirigida e amigavel, com exemplo pratico quando ajudar.
3. Material com contrato VIGENTE na tabela CONTRATOS_COMPRAS: avise que ja tem contrato (cite fornecedor e preco) e que vai preparar a autorizacao de fornecimento para a Daniela aprovar.
4. Material sem contrato: avise que segue para cotacao com fornecedores.
5. Duvida tecnica de projeto/acabamento sem resposta nos dados: oriente confirmar com a arquitetura/engenharia via Daniela.
6. Voce PREPARA, humanos APROVAM. Nunca diga que comprou, fechou ou pagou algo.
7. Se a mensagem nao for sobre compras/obra, responda gentilmente que voce cuida das compras da Prisbel.
8. STATUS: quando perguntarem de pedidos ou pendencias, USE a tabela PEDIDOS dos dados: resuma por numero (item, status, pendencia em aberto). Se pedirem os pedidos da pessoa e nao der pra saber quem e, mostre os mais recentes (ate 5) e ofereca filtrar. Priorize itens com PENDENCIAS preenchida ou status diferente de COMPLETO.

CALIBRACOES:
- Saco e unidade padrao de cimento/argamassa/cal/gesso. Lata, rolo, par, barra, kg, m2, m3, caminhao sao unidades validas.
- CP II-32 (cimento), AC1/AC2/AC3 (argamassa colante), CA-50/CA-60 (aco) JA SAO a classe: nao pergunte de novo.
- Tijolo/bloco de vedacao nao exige MPa (so os estruturais).
- Preserve TODAS as especificacoes que a pessoa ja deu; nao repita pergunta ja respondida no historico.
- Numero junto de PEDIDO/REQUISICAO/RM e numero de documento, nunca quantidade.

REQUISITOS R09 (campos minimos por material):
${R09}`;

/* ---------------- código dos nodes da API ---------------- */
const jsValidar =
  `const token = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const b = $json.body || {};\n` +
  `return [{ json: {\n` +
  `  valido: b.t === token,\n` +
  `  mensagem: String(b.mensagem || '').slice(0, 2000),\n` +
  `  obra: String(b.obra || '').slice(0, 60),\n` +
  `  historico: Array.isArray(b.historico) ? b.historico.slice(-12) : [],\n` +
  `  audio: (b.audio && typeof b.audio.data === 'string' && b.audio.data.length < 4000000)\n` +
  `    ? { mime: String(b.audio.mime || 'audio/mp4').slice(0, 40), data: b.audio.data } : null,\n` +
  `} }];\n`;

const jsMontar =
  `const req = $('Validar').first().json;\n` +
  `const vr = ($json.valueRanges || []);\n` +
  `const aba = (i, nome, max) => {\n` +
  `  const rows = (vr[i] && vr[i].values) || [];\n` +
  `  const corpo = rows.slice(0, 1).concat(rows.slice(1).slice(-max));\n` +
  `  if (corpo.length <= 1) return '## ' + nome + '\\n(vazia)';\n` +
  `  return '## ' + nome + '\\n' + corpo.map(r => r.join(' | ')).join('\\n');\n` +
  `};\n` +
  `const dados = [aba(0,'OBRAS',15), aba(1,'PESSOAS',20), aba(2,'CONTRATOS_COMPRAS',50), aba(3,'FATOS',50), aba(4,'PEDIDOS (do piloto, colunas: '+'A=N PEDIDO ate P=ITEM N)',40)].join('\\n\\n');\n` +
  `const hist = req.historico.map(h => (h.de === 'bella' ? 'Bella: ' : 'Usuario: ') + h.texto).join('\\n');\n` +
  `const prompt = ${JSON.stringify(SYSTEM)} +\n` +
  `  '\\n\\nDADOS AO VIVO (planilha de compras):\\n' + dados +\n` +
  `  '\\n\\nOBRA ATUAL DO USUARIO: ' + (req.obra || 'nao informada') +\n` +
  `  '\\n\\nHISTORICO DA CONVERSA:\\n' + (hist || '(inicio)') +\n` +
  `  (req.audio\n` +
  `    ? '\\n\\nNOVA MENSAGEM DO USUARIO: veio em AUDIO (anexo). Transcreva o audio em portugues e responda ao conteudo transcrito.' +\n` +
  `      '\\n\\nResponda SOMENTE com JSON valido no formato {\\"transcricao\\": \\"texto transcrito\\", \\"resposta\\": \\"sua resposta\\"}'\n` +
  `    : '\\n\\nNOVA MENSAGEM DO USUARIO: ' + req.mensagem +\n` +
  `      '\\n\\nResponda SOMENTE com JSON valido no formato {\\"resposta\\": \\"seu texto aqui\\"}');\n` +
  `const parts = [{ text: prompt }];\n` +
  `if (req.audio) parts.push({ inline_data: { mime_type: req.audio.mime, data: req.audio.data } });\n` +
  `const payload = {\n` +
  `  contents: [{ role: 'user', parts }],\n` +
  `  generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },\n` +
  `};\n` +
  `return [{ json: { payload } }];\n`;

const jsProcessar =
  `let resposta = 'Opa, me embolei aqui. Pode repetir, por favor?';\n` +
  `let transcricao = '';\n` +
  `try {\n` +
  `  const txt = $json.candidates[0].content.parts[0].text;\n` +
  `  const obj = JSON.parse(txt);\n` +
  `  if (obj && obj.resposta) resposta = String(obj.resposta);\n` +
  `  if (obj && obj.transcricao) transcricao = String(obj.transcricao);\n` +
  `} catch (e) {}\n` +
  `return [{ json: { resposta, transcricao } }];\n`;

/* ---------------- workflow ---------------- */
const NAME = 'WF7 - Bella Chat Prototipo';
const respondJson = (name, body, pos) => ({
  name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos,
  parameters: { respondWith: 'text', responseBody: body,
    options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }] } } },
});
const workflow = {
  name: NAME,
  settings: { executionOrder: 'v1' },
  nodes: [
    // --- página ---
    { name: 'Página', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, -160],
      webhookId: 'b7c00001-0000-4000-8000-000000000001',
      parameters: { httpMethod: 'GET', path: 'bella-chat', responseMode: 'responseNode', options: {} } },
    { name: 'Servir protótipo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, -160],
      parameters: { jsCode: jsServe } },
    { name: 'Responder página', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, -160],
      parameters: { respondWith: 'text', responseBody: '={{ $json.html }}',
        options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } } } },
    // --- API ---
    { name: 'API Chat', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 120],
      webhookId: 'b7c00002-0000-4000-8000-000000000002',
      parameters: { httpMethod: 'POST', path: 'bella-chat-api', responseMode: 'responseNode', options: {} } },
    { name: 'Validar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [200, 120],
      parameters: { jsCode: jsValidar } },
    { name: 'Token ok?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [380, 120],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-token', leftValue: '={{ $json.valido }}', rightValue: 'true',
          operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      } } },
    { name: 'Ler dados', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [580, 40],
      executeOnce: true, alwaysOutputData: true,
      parameters: { method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=OBRAS!A1:G20&ranges=PESSOAS!A1:G30&ranges=CONTRATOS_COMPRAS!A1:O80&ranges=FATOS!A1:G80&ranges=PEDIDOS!A1:P120`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    { name: 'Montar prompt', type: 'n8n-nodes-base.code', typeVersion: 2, position: [780, 40],
      parameters: { jsCode: jsMontar } },
    { name: 'Gemini', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [980, 40],
      executeOnce: true,
      parameters: { method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.payload) }}', options: {} },
      credentials: { httpHeaderAuth: { id: 'MgtrdiyIibEc7OYw', name: 'Gemini' } } },
    { name: 'Processar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1180, 40],
      parameters: { jsCode: jsProcessar } },
    respondJson('Responder API', '={{ JSON.stringify({resposta: $json.resposta, transcricao: $json.transcricao || undefined}) }}', [1380, 40]),
    respondJson('Responder negado', JSON.stringify({ resposta: 'Acesso negado.' }), [580, 220]),
  ],
  connections: {
    'Página': { main: [[{ node: 'Servir protótipo', type: 'main', index: 0 }]] },
    'Servir protótipo': { main: [[{ node: 'Responder página', type: 'main', index: 0 }]] },
    'API Chat': { main: [[{ node: 'Validar', type: 'main', index: 0 }]] },
    'Validar': { main: [[{ node: 'Token ok?', type: 'main', index: 0 }]] },
    'Token ok?': { main: [
      [{ node: 'Ler dados', type: 'main', index: 0 }],
      [{ node: 'Responder negado', type: 'main', index: 0 }],
    ] },
    'Ler dados': { main: [[{ node: 'Montar prompt', type: 'main', index: 0 }]] },
    'Montar prompt': { main: [[{ node: 'Gemini', type: 'main', index: 0 }]] },
    'Gemini': { main: [[{ node: 'Processar', type: 'main', index: 0 }]] },
    'Processar': { main: [[{ node: 'Responder API', type: 'main', index: 0 }]] },
  },
};

/* ---------------- cria/atualiza + bounce + smoke ---------------- */
const list = await api('GET', `/workflows?name=${encodeURIComponent(NAME)}`);
const existing = list.data?.[0];
let id;
if (existing) {
  id = existing.id;
  if (existing.active) await api('POST', `/workflows/${id}/deactivate`);
  await api('PUT', `/workflows/${id}`, workflow);
  console.log('workflow atualizado:', id);
} else {
  id = (await api('POST', '/workflows', workflow)).id;
  console.log('workflow criado:', id);
}
await api('POST', `/workflows/${id}/activate`);

const pageRes = await fetch(`${N8N_BASE_URL}/webhook/bella-chat?t=${BELLA_CHAT_TOKEN}`);
console.log(`página → HTTP ${pageRes.status}, v0.3: ${(await pageRes.text()).includes('v0.3')}`);
const chatRes = await fetch(`${N8N_BASE_URL}/webhook/bella-chat-api`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ t: BELLA_CHAT_TOKEN, obra: 'Paradiso', mensagem: 'Manda 50 sacos de cimento e um rolo de lona preta', historico: [] }),
});
console.log(`api → HTTP ${chatRes.status}:`);
console.log(await chatRes.text());
const negRes = await fetch(`${N8N_BASE_URL}/webhook/bella-chat-api`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ t: 'errado', mensagem: 'oi' }),
});
console.log(`token errado → HTTP ${negRes.status}: ${await negRes.text()}`);
console.log(`\nURL: ${N8N_BASE_URL}/webhook/bella-chat?t=${BELLA_CHAT_TOKEN}`);
