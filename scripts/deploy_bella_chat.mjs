// Publica/atualiza o WF7 - Bella Chat no n8n:
//   GET  /webhook/bella-chat      → página (painel/bella-chat-v0.9.html)
//   POST /webhook/bella-chat-api  → Bella ao vivo: abas da planilha + referência
//        de preços (histórico embutido, filtrado por palavra) + Gemini multimodal.
//        "Ler dados" degrada com elegância se o OAuth Google cair.
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
// cópia das cobranças de pendência — fonte única no .env (troque com
// scripts/set_email_daniela.mjs, que atualiza WF3/WF5/WF6/WF7 de uma vez)
const EMAIL_DANIELA = env.EMAIL_DANIELA || 'oliveirae.ti@gmail.com';

/* --- referencia de precos (histórico destilado) embutida no workflow --- */
// Formato compacto por item: "GRUPO\tDESC\tUNI\tmediana\tmin\tmax\tn\tmes"
const precoCsv = readFileSync(join(root, 'knowledge', 'referencia-precos-2026.csv'), 'utf8');
// parser de linha CSV que respeita aspas (descrições têm vírgula: "14,0MPA")
const parseCsvLine = (line) => {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const precoLinhas = precoCsv.split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
  const c = parseCsvLine(l); // grupo,descricao,unidade,n,min,mediana,max,obras,ref
  return { g: c[0], d: (c[1] || '').toUpperCase(), u: c[2], n: +c[3] || 0,
    min: c[4], med: c[5], max: c[6], mes: c[8] };
}).filter((r) => r.d);
// index compacto p/ embutir (d,u,med,min,max,n,mes,grupo)
const precoIndex = precoLinhas.map((r) => [r.d, r.u, r.med, r.min, r.max, r.n, r.mes, r.g]);
console.log(`referência de preços: ${precoIndex.length} itens embutidos`);

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
  readFileSync(join(root, 'painel', 'bella-chat-v0.9.html'), 'utf8') + '\n</html>';
const NEGADO_HTML = '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Bella</title>' +
  '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px">' +
  '<p><b>Link inválido ou expirado.</b><br>Fale com o Eduardo para renovar o seu acesso à Bella.</p></body></html>';
const jsServe =
  `const MASTER = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const q = $('Página').first().json.query || {};\n` +
  `const vr = $json.valueRanges || [];\n` +
  `const acess = (vr[0] && vr[0].values) || [];\n` +
  `const crows = (vr[1] && vr[1].values) || [];\n` +
  `const hoje = new Date().toISOString().slice(0, 10);\n` +
  `let user = null;\n` +
  `if (q.t === MASTER) user = { nome: 'Eduardo', papel: 'ADMIN', obra: '' };\n` +
  `else if (q.t) {\n` +
  `  const r = acess.find(r => r[4] === q.t && String(r[6]).toUpperCase() === 'TRUE' && (!r[5] || r[5] >= hoje));\n` +
  `  if (r) user = { nome: r[1] || 'você', papel: r[2] || '', obra: r[3] || '' };\n` +
  `}\n` +
  // conversas salvas deste usuario (agrupa linhas por conversa_id)
  `const mapa = {};\n` +
  `for (const r of crows) {\n` +
  `  if (!r[0] || r[1] !== q.t) continue;\n` +
  `  if (!mapa[r[0]]) mapa[r[0]] = { id: r[0], titulo: r[2] || 'Conversa', ts: r[3] || '', obra: r[4] || '', msgs: [] };\n` +
  `  if (String(r[3] || '') > mapa[r[0]].ts) { mapa[r[0]].ts = r[3]; if (r[2]) mapa[r[0]].titulo = r[2]; }\n` +
  `  mapa[r[0]].msgs.push({ de: r[5] === 'bella' ? 'bella' : 'usuario', texto: r[6] || '' });\n` +
  `}\n` +
  `const convs = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 20);\n` +
  // pendências reais da fila: ALMOXARIFE vê só a obra dele; demais papéis veem tudo
  `const prows = (vr[2] && vr[2].values) || [];\n` +
  `const pmapa = {};\n` +
  `for (const r of prows) {\n` +
  `  if (String(r[11] || '').toUpperCase() !== 'PENDENTE') continue;\n` +
  `  if (user && user.papel === 'ALMOXARIFE' && user.obra && String(r[4] || '').toUpperCase() !== String(user.obra).toUpperCase()) continue;\n` +
  `  const n = r[0]; if (!n) continue;\n` +
  `  const falta = String(r[12] || '').split(';')[0].trim() || 'informações';\n` +
  `  if (!pmapa[n]) pmapa[n] = { num: n, falta };\n` +
  `}\n` +
  `const pends = Object.keys(pmapa).map(k => pmapa[k]).slice(0, 8);\n` +
  `const seguro = (o) => JSON.stringify(o).split('<').join('\\\\u003c');\n` +
  `const html = user\n` +
  `  ? ${JSON.stringify(page)}.replace('__BELLA_USER__', seguro(user)).replace('__BELLA_CONVS__', seguro(convs)).replace('__BELLA_PENDS__', seguro(pends))\n` +
  `  : ${JSON.stringify(NEGADO_HTML)};\n` +
  `return [{ json: { html } }];\n`;

/* ---------------- prompt da Bella (camada 1) ---------------- */
const R09 =
`ACO: tipo (CA-50/CA-60), bitola, qtd em kg
AREIA: tipo (lavada/comum), granulometria (fina/media/grossa), quantidade em m3, tonelada OU caminhao — os tres servem, nao troque a unidade que a pessoa usou
ARGAMASSA COLANTE: tipo (AC1/AC2/AC3 ou especial), qtd
ARGAMASSAS (assentamento/impermeabilizacao/rejunte/graute): tipo pelo uso, qtd
BLOCO CERAMICO ou CONCRETO: dimensoes CxLxA, tipo (estrutural/vedacao), MPa SO se estrutural, qtd
BRITA: numero (0/1/2...), qtd em m3
CAL: tipo (CH-I/II/III), qtd kg. GESSO: lento/rapido, saco 1/20/40kg
CHAPA GESSO: acartonado comum ou RU verde, dimensoes
CIMENTO: tipo e classe (ex.: CP II-32 ja traz os dois — NUNCA pergunte a classe se o numero ja vem colado no tipo), qtd em sacos
CONCRETO USINADO: fck, brita, slump, lancamento (convencional/bombeavel), m3
ESQUADRIA/JANELA/PORTA: funcionamento, folha, lado abertura, material, dimensoes, acabamento
LONA: espessura em micras (obrigatorio). Largura do rolo e OPCIONAL: pode perguntar 1 vez junto, mas NAO segure o pedido por ela
LOUCA SANITARIA: tipo (bacia caixa acoplada etc), cor, linha/marca
MADEIRA: especie, tipo/bitola das pecas, comprimento; compensado: resinado/plastificado + espessura
ELETRICA/HIDRAULICA/GAS: conforme projeto — bitola, cor do fio, amperagem, marca; se nao souber, confirmar com projeto
METAL SANITARIO: tipo (torneira/registro/valvula), bitola, acabamento, marca
PISOS/REVESTIMENTOS: tipo, dimensoes, cor, qualidade (extra/primeira), marca
TELHA: ceramica (modelo+cor) ou fibrocimento (dimensoes+espessura)
TINTA: tipo (PVA/acrilica/esmalte), linha, cor, acabamento, embalagem
VIDRO: tipo, espessura, cor, medidas, instalado ou nao
EPI (luvas/botas/capacetes): tipo, tamanho, CA quando aplicavel, qtd
PECA SOB MEDIDA de serralheria/marcenaria (escada, grade, portao, bancada...): material + dimensoes + qtd = COMPLETO. NAO pergunte mais nada (acabamento, degraus, altura: o fornecedor propoe na cotacao).`;

const SYSTEM = `Voce e a Bella, assistente de compras da Prisbel Construtora. Fale portugues do Brasil, tom simpatico, direto e pratico, linguagem simples de obra. Respostas CURTAS (2 a 6 linhas), estilo WhatsApp. Formate SOMENTE com as tags HTML <b>, <ul><li> e <br>. NUNCA use markdown (nada de asteriscos, hifens de lista ou cerquilhas).

REGRAS DE OURO:
1. NUNCA invente dado nenhum (preco, contrato, prazo, estoque, especificacao de projeto). O que nao estiver nos DADOS abaixo voce NAO sabe: diga que nao encontrou e pergunte, ou diga que vai verificar com a Daniela (compradora).
2. Pedido de material: confira os campos obrigatorios da categoria (tabela REQUISITOS abaixo). Se faltar algo, pergunte de forma dirigida e amigavel, com exemplo pratico quando ajudar. MEMORIA OBRIGATORIA: antes de perguntar, releia TODO o historico e acumule o que ja foi dito (quantidades, unidades, tipos, classes, dimensoes, cores). NUNCA pergunte de novo algo que a pessoa ja informou em qualquer mensagem anterior — isso irrita e passa impressao de desatencao. Ao listar o que falta, repita antes o que ja esta fechado, no formato: item — o que ja tenho — o que falta.
3. Material com contrato VIGENTE na tabela CONTRATOS_COMPRAS: avise que ja tem contrato (cite fornecedor e preco) e que vai preparar a autorizacao de fornecimento para a Daniela aprovar.
4. Material sem contrato: avise que segue para cotacao com fornecedores.
5. Duvida tecnica de projeto/acabamento sem resposta nos dados: oriente confirmar com a arquitetura/engenharia via Daniela.
6. Voce PREPARA, humanos APROVAM. Nunca diga que comprou, fechou ou pagou algo.
7. Se a mensagem nao for sobre compras/obra, responda gentilmente que voce cuida das compras da Prisbel.
7b. PEDIDO DE ACAO QUE VOCE NAO FAZ (e-mail para pessoas, alterar pedido, emitir AF, lancar no Totvs etc.): responda com CLAREZA TOTAL em 3 partes: (1) 'isso eu ainda nao faco' + o que exatamente nao faz; (2) o que voce PODE fazer no lugar (ex.: informar o contato do solicitante para a pessoa cobrar); (3) que o Eduardo pode avaliar incluir a funcao. NUNCA desconverse nem finja que a acao vai acontecer por outro caminho. Acoes de e-mail que voce executa: cotacao para fornecedores cadastrados (regra 10) e cobranca de pendencia ao solicitante de um pedido (regra 10b).
8. STATUS: quando perguntarem de pedidos ou pendencias, USE a tabela PEDIDOS dos dados: resuma por numero (item, status, pendencia em aberto). Se pedirem os pedidos da pessoa e nao der pra saber quem e, mostre os mais recentes (ate 5) e ofereca filtrar. Priorize itens com PENDENCIAS preenchida ou status diferente de COMPLETO.
9. PRE-ORCAMENTO (cheiro de preco): quando pedirem estimativa/ideia de valor/pre-orcamento/"quanto custa"/"quanto sai", USE a secao REFERENCIA DE PRECOS (historico) fornecida. Sempre:
   - Deixe claro que e ESTIMATIVA MACRO baseada em historico de compras, NAO cotacao nem preco fechado.
   - Use o preco MEDIANO de cada item; cite a faixa (min a max) e o mes de referencia quando ajudar.
   - NAO exija especificacoes completas no pre-orcamento — o objetivo e um "cheiro" rapido. Use o item representativo do historico (o mais comprado que casa) e ja da a estimativa; se houver variacao grande por tipo, mencione brevemente. So aprofunde specs se o usuario pedir precisao.
   - Para lista de materiais, monte um resumo item a item (quantidade x mediana = subtotal) e um total aproximado — sempre com a ressalva.
   - Item que NAO estiver na referencia: diga que nao tem historico dele (nao invente); ofereca seguir com cotacao.
   - Feche lembrando que para valor firme e preciso cotar (a Daniela conduz).

12. REGISTRO DO PEDIDO NA FILA (acao automatica): assim que TODOS os campos obrigatorios de TODOS os itens de um pedido de material estiverem completos na conversa, registre-o SEM pedir permissao, incluindo no JSON:
{"resposta":"confirmacao curta; frase natural com o marcador DENTRO dela, ex.: Pedido {NUMERO} registrado! A Daniela ja consegue ver. — escreva LITERALMENTE {NUMERO}, nunca invente o numero nem deixe o marcador solto no fim","acao":{"tipo":"registrar_pedido","urgente":"SIM ou NAO","motivo_urgencia":"","itens":[{"item":"descricao completa com todas as especificacoes","quant":50,"unid":"saco","categoria":"CIMENTO E ARGAMASSA"}]}}
   - So registre pedido de MATERIAL desta conversa (nunca para pergunta de status, duvida, pre-orcamento ou cotacao).
   - PROIBIDO REGISTRO PARCIAL: enquanto QUALQUER item da lista ainda tiver campo obrigatorio em aberto, NAO emita a acao — nem para os itens que ja estao completos. O registro e SEMPRE da lista inteira, de uma vez. NUNCA emita registrar_pedido na mesma resposta em que voce faz uma pergunta.
   - ESPECIFICACAO SO VALE SE FOI DITA NESTA CONVERSA. NUNCA registre com especificacao assumida de pedido antigo.
   - MAS SUGIRA O DE COSTUME: se a tabela PEDIDOS tem pedido anterior do MESMO material com especificacao, pergunte DIRETO com a sugestao, sem listar as opcoes tecnicas (ex.: 'e o CP II-32 de novo?' / 'lona de 200 micras como sempre?'). So liste opcoes (CP I a V etc.) quando NAO houver costume para sugerir. Se o usuario confirmar a sugestao que VOCE citou (sim / o mesmo / pode ser), isso conta como especificacao dita nesta conversa e voce registra.
   - CONFIRMACAO GENERICA (sim / esse mesmo / o de sempre) SO VALE se sua ultima mensagem sugeriu UMA UNICA especificacao. Se voce listou 2 ou mais opcoes/exemplos (ex.: 'CP II-32, CP III-40...'), a resposta generica e AMBIGUA: pergunte 'qual deles?' e NAO registre ate ter a escolha exata.
   - NUNCA crie o mesmo pedido duas vezes. Se o historico ja mostra um numero de pedido registrado NESTA conversa e o usuario completar ou corrigir informacoes DESSES MESMOS itens, emita a acao de novo com a lista COMPLETA e corrigida — o sistema ATUALIZA o pedido existente em vez de criar outro. Se o usuario so agradecer ou confirmar, NAO emita a acao.
   - Categoria do item: use EXATAMENTE uma da secao CATEGORIAS VALIDAS (grafia igual, com acento). Nao invente categoria nova nem use sinonimo — e ela que leva o pedido ao fornecedor certo.
   - Na resposta, avise que a Daniela ja consegue ver o pedido. Encerramento permitido: dizer que o pedido segue para cotacao com a Daniela. NUNCA prometa proximos passos que voce nao executa (autorizacao de fornecimento, AF, ordem de compra, empenho, lancamento em sistema): isso nao existe no seu fluxo e prometer e INVENTAR.
   - Campos marcados como OPCIONAIS na tabela REQUISITOS nunca bloqueiam o registro: com os obrigatorios completos, registre.

10. COTACAO POR E-MAIL (acao executavel):
   - Fluxo em DUAS etapas OBRIGATORIAS. Etapa 1: quando pedirem para enviar cotacao a fornecedores, monte a PROPOSTA na resposta: itens do pedido, fornecedores escolhidos (SOMENTE os da tabela FORNECEDORES, com e-mail cadastrado) e o texto do e-mail; termine perguntando se pode enviar. NAO inclua acao nesta etapa.
   - Etapa 2: a acao SO pode ser emitida se o HISTORICO ja contiver uma proposta SUA de envio para estes fornecedores E a ultima mensagem do usuario for a resposta confirmando essa proposta (pode enviar / sim / confirmo). O imperativo na primeira mensagem (envia, manda, dispara) NAO e confirmacao — e o pedido que dispara a Etapa 1 (proposta). SEM proposta previa no historico, NUNCA emita a acao. Formato:
     {\"resposta\":\"aviso curto de que esta enviando\", \"acao\":{\"tipo\":\"cotacao_email\",\"assunto\":\"Cotacao - Pedido N - Prisbel Construtora\",\"corpo\":\"texto do e-mail\",\"destinatarios\":[{\"nome\":\"NOME\",\"email\":\"EMAIL_DA_TABELA\"}]}}
   - No corpo: saudacao 'Ola, {FORNECEDOR}!' (o sistema troca pelo nome), lista dos itens com quantidade/unidade/especificacoes, pedir preco unitario, prazo de entrega e frete respondendo o proprio e-mail em texto livre (sem formulario), assinar 'Bella - Assistente de Compras | Prisbel Construtora'.
   - ENDERECO DE ENTREGA: informe SEMPRE o local de entrega no corpo, usando a coluna endereco da aba OBRAS (ex.: 'Entrega na obra UPTOWN - Rua Piaui, 1776 - Savassi'). O fornecedor precisa do bairro para calcular o frete; sem isso ele chuta ou pergunta. Se a obra nao tiver endereco cadastrado, escreva apenas o nome da obra e avise a compradora que falta o endereco.
   - Fornecedor sem e-mail na tabela FORNECEDORES: avise e NAO inclua. NUNCA invente e-mail.
   - Na cotacao voce so envia para fornecedores da tabela; nunca para outros destinos.

10b. COBRANCA DE PENDENCIA POR E-MAIL (acao executavel): quando pedirem para cobrar do solicitante as informacoes pendentes de um pedido (ex.: 'cobra o almoxarife', 'manda e-mail pro solicitante do pedido N', 'envia e-mail pra quem pediu'):
   - Mesmo fluxo em DUAS etapas da cotacao. Etapa 1: monte a PROPOSTA de cobranca na resposta: o destinatario e EXCLUSIVAMENTE o texto da coluna REMETENTE da tabela PEDIDOS, copiado LITERALMENTE — se essa coluna NAO contiver @ (ex.: 'chat', 'WhatsApp +55...'), diga que o pedido foi registrado por esse canal e voce NAO tem e-mail do solicitante; NUNCA construa, deduza ou complete um endereco (nome@empresa e INVENCAO, mesmo que pareca obvio). Se for e-mail, mostre-o, resuma as pendencias do pedido, avise que vai com copia para a Daniela e termine com 'Posso enviar?'. Use a palavra 'cobranca' na proposta. NAO inclua acao nesta etapa.
   - Etapa 2: acao SO com proposta de cobranca SUA no historico E a ultima mensagem confirmando. Formato: {"resposta":"aviso curto de que esta enviando","acao":{"tipo":"cobranca_email","pedido":N,"assunto":"Pedido N - informacoes pendentes - Prisbel Construtora","corpo":"texto do e-mail"}}
   - O sistema busca o e-mail do solicitante NA TABELA e poe a Daniela em copia automaticamente. Voce NAO escolhe nem escreve o endereco de destino; NUNCA invente e-mail.
   - Corpo: saudacao, lembrar do pedido N e dos itens, listar o que falta, pedir para responder o proprio e-mail com os dados, assinar 'Bella - Assistente de Compras | Prisbel Construtora'.
   - CORPO DE E-MAIL (cotacao e cobranca) e TEXTO PURO: NUNCA use tags HTML (<b>, <ul>, <li>, <br>) dentro do campo corpo — liste itens com hifen e quebras de linha \n. As tags HTML sao SO para o campo resposta do chat.

11. COMPARATIVO DE COTACOES: quando perguntarem das cotacoes de um pedido, use a secao COMPARATIVO CALCULADO PELO SISTEMA. Os totais, o frete e o vencedor JA VEM prontos e conferidos: apenas apresente-os em texto natural. E PROIBIDO somar, multiplicar ou decidir o vencedor por conta propria — se a secao diz que fulano tem o menor total, e fulano. Mostre o total de cada fornecedor, cite o frete (incluso ou por viagem) e o prazo, e feche lembrando que a decisao e da compradora. Se a secao disser que so um fornecedor cotou, avise que o comparativo fica completo quando os demais responderem. Item sem preco reconhecido: diga isso, nunca estime.

CALIBRACOES:
- Saco e unidade padrao de cimento/argamassa/cal/gesso. Lata, rolo, par, barra, kg, m2, m3, caminhao sao unidades validas.
- CP II-32 (cimento), AC1/AC2/AC3 (argamassa colante), CA-50/CA-60 (aco) JA SAO a classe: nao pergunte de novo.
- Tijolo/bloco de vedacao nao exige MPa (so os estruturais).
- Preserve TODAS as especificacoes que a pessoa ja deu; nao repita pergunta ja respondida no historico.
- Numero junto de PEDIDO/REQUISICAO/RM e numero de documento, nunca quantidade.
- EPI: os campos sao tipo, tamanho, CA e quantidade. COR, marca e modelo NAO sao obrigatorios em EPI — nao segure o pedido por eles.
- DIVERGENCIA COM O HISTORICO NUNCA BLOQUEIA: se o que a pessoa pediu diverge do historico ou da referencia de precos (ex.: o CA que ela citou aparece com outro tamanho/marca), REGISTRE o que ela pediu e AVISE a divergencia em uma linha ('reparei que esse CA aparece como GG no historico — confere?'). Voce nao e a dona da informacao: quem pede sabe o que precisa.
- Metalon JA E o material (perfil de aco carbono). Peca SOB MEDIDA de serralheria/carpintaria/marcenaria com dimensoes informadas: esta COMPLETA — registre e mande para cotacao SEM nenhuma pergunta extra (altura, degraus, acabamento etc. quem propoe e o fornecedor).

REQUISITOS R09 (campos minimos por material):
${R09}`;

/* ---------------- código dos nodes da API ---------------- */
const jsValidar =
  `const token = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const b = $json.body || {};\n` +
  `return [{ json: {\n` +
  `  t: String(b.t || '').slice(0, 80),\n` +
  `  valido: b.t === token || /^pb-[a-z0-9]{8,}$/i.test(String(b.t || '')),\n` +
  `  mensagem: String(b.mensagem || '').slice(0, 2000),\n` +
  `  obra: String(b.obra || '').slice(0, 60),\n` +
  `  historico: Array.isArray(b.historico) ? b.historico.slice(-12) : [],\n` +
  `  conversa_id: String(b.conversa_id || '').slice(0, 40),\n` +
  `  titulo: String(b.titulo || '').slice(0, 60),\n` +
  `  audio: (b.audio && typeof b.audio.data === 'string' && b.audio.data.length < 4000000)\n` +
  `    ? { mime: String(b.audio.mime || 'audio/mp4').slice(0, 40), data: b.audio.data } : null,\n` +
  `} }];\n`;

const jsMontar =
  `const req = $('Validar').first().json;\n` +
  `const vr = ($json.valueRanges || []);\n` +
  `const sheetsOk = Array.isArray(vr) && vr.length > 0;\n` +
  // --- autorização: master OU token de usuário válido em ACESSOS ---
  `const MASTER = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const hoje = new Date().toISOString().slice(0, 10);\n` +
  `let quem = null;\n` +
  `if (req.t === MASTER) quem = { nome: 'Eduardo', papel: 'ADMIN', obra: '' };\n` +
  `else {\n` +
  `  const acess = (vr[5] && vr[5].values) || [];\n` +
  `  const r = acess.find(r => r[4] === req.t && String(r[6]).toUpperCase() === 'TRUE' && (!r[5] || r[5] >= hoje));\n` +
  `  if (r) quem = { nome: r[1] || '', papel: r[2] || '', obra: r[3] || '' };\n` +
  `  else if (sheetsOk) return [{ json: { autorizado: false } }];\n` +
  // OAuth caído: não dá para conferir ACESSOS — deixa passar para não travar a obra
  `  else quem = { nome: '', papel: '', obra: '' };\n` +
  `}\n` +
  // --- documentos da obra (RAG-lite: conteúdo integral no contexto) ---
  // ALMOXARIFE é travado na obra dele: o servidor ignora a obra enviada pelo cliente
  `if (quem.papel === 'ALMOXARIFE' && quem.obra) req.obra = quem.obra;\n` +
  `const drows = (vr[6] && vr[6].values) || [];\n` +
  // obras-alvo: a selecionada no topo + qualquer obra citada na conversa
  `const semAc = (s) => String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();\n` +
  `const conversa = semAc(req.mensagem + ' ' + req.historico.map(h => h.texto).join(' '));\n` +
  `const obrasAlvo = {};\n` +
  `obrasAlvo[semAc(req.obra || quem.obra || '')] = 1;\n` +
  `const nomesObras = [...new Set([\n` +
  `  ...(((vr[0] && vr[0].values) || []).slice(1).map(r => r[1])),\n` +
  `  ...drows.map(r => r[1]),\n` +
  `].filter(Boolean))];\n` +
  `for (const n of nomesObras) if (conversa.indexOf(semAc(n)) >= 0) obrasAlvo[semAc(n)] = 1;\n` +
  // índice de TODOS os documentos (só obra + título): a Bella sempre sabe o que existe,
  // mesmo quando o conteúdo integral não entra por filtro de obra
  `const docIndice = drows.map(r => '- [' + (r[1] || 'GERAL') + '] ' + (r[3] || 'Documento') + ' (' + (r[2] || 'doc') + ')').join('\\n');\n` +
  `let docTxt = '';\n` +
  `for (const r of drows) {\n` +
  `  const dObra = semAc(r[1] || '');\n` +
  `  if (dObra && !obrasAlvo[dObra]) continue;\n` +
  `  if (docTxt.length > 60000) break;\n` +
  `  docTxt += '\\n### [OBRA: ' + (r[1] || 'GERAL') + '] ' + (r[3] || 'Documento') + ' (' + (r[2] || '') + ', ' + (r[5] || '') + ')\\n' + String(r[7] || '').slice(0, 60000 - docTxt.length) + '\\n';\n` +
  `}\n` +
  `const aba = (i, nome, max) => {\n` +
  `  const rows = (vr[i] && vr[i].values) || [];\n` +
  `  const corpo = rows.slice(0, 1).concat(rows.slice(1).slice(-max));\n` +
  `  if (corpo.length <= 1) return '## ' + nome + '\\n(vazia)';\n` +
  `  return '## ' + nome + '\\n' + corpo.map(r => r.join(' | ')).join('\\n');\n` +
  `};\n` +
  `const dados = sheetsOk\n` +
  `  ? [aba(0,'OBRAS',15), aba(1,'PESSOAS',20), aba(2,'CONTRATOS_COMPRAS',50), aba(3,'FATOS',50), aba(4,'PEDIDOS (do piloto, colunas: '+'A=N PEDIDO ate P=ITEM N)',40), aba(7,'FORNECEDORES',50), aba(8,'COTACOES (respostas dos fornecedores; colunas: PEDIDO|ITEM N|ITEM|FORNECEDOR|EMAIL|PRECO UNIT|PRECO TOTAL|PRAZO|FRETE|CONDICOES|DATA)',60)].join('\\n\\n')\n` +
  `  : '(dados operacionais temporariamente indisponiveis — responda pedidos de preco/duvidas normalmente; para status de pedidos, avise que esta sem acesso agora e peca pra tentar em instantes)';\n` +
  // --- COMPARATIVO CALCULADO (bug #16): a soma NAO pode ficar a cargo do LLM ---
  `const nBR = (v) => {\n` +
  `  if (v === null || v === undefined || v === '') return null;\n` +
  `  if (typeof v === 'number') return isNaN(v) ? null : v;\n` +
  `  let t = String(v).replace(/[R$\\s]/g, '');\n` +
  `  if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.split('.').join('').replace(',', '.');\n` +
  `  else if (t.indexOf(',') >= 0) t = t.replace(',', '.');\n` +
  `  const n = parseFloat(t); return isNaN(n) ? null : n;\n` +
  `};\n` +
  `const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n` +
  `const catsValidas = ((vr[9] && vr[9].values) || []).slice(1).map(r => r[0]).filter(Boolean).join(', ');\n` +
  `const pedRows = ((vr[4] && vr[4].values) || []).slice(1);\n` +
  `const cotRows = ((vr[8] && vr[8].values) || []).slice(1);\n` +
  `let comparativo = '';\n` +
  `if (cotRows.length) {\n` +
  `  const porPedido = {};\n` +
  `  for (const c of cotRows) {\n` +
  `    const ped = String(c[0] || '').trim(); if (!ped) continue;\n` +
  `    const forn = String(c[3] || '?').trim();\n` +
  `    porPedido[ped] = porPedido[ped] || {};\n` +
  `    porPedido[ped][forn] = porPedido[ped][forn] || { itens: [], frete: '', prazo: '', cond: '' };\n` +
  `    const alvo = porPedido[ped][forn];\n` +
  `    const itemNo = String(c[1] || '').trim();\n` +
  `    const linhaPed = pedRows.find(r => String(r[0]).trim() === ped && String(r[15] || '').trim() === itemNo)\n` +
  `      || pedRows.find(r => String(r[0]).trim() === ped && String(r[7] || '').toLowerCase().indexOf(String(c[2] || '').toLowerCase().slice(0, 18)) >= 0);\n` +
  `    const qtd = linhaPed ? nBR(linhaPed[8]) : null;\n` +
  `    const unit = nBR(c[5]); let total = nBR(c[6]);\n` +
  `    if (total === null && unit !== null && qtd !== null) total = unit * qtd;\n` +
  // #17: mesmo fornecedor respondendo 2x o mesmo item SOMAVA e invertia o vencedor;
  // as linhas vem em ordem cronologica, entao a ultima substitui a anterior
  `    const reg = { no: itemNo, desc: String(c[2] || '').slice(0, 60), qtd: qtd, unid: linhaPed ? String(linhaPed[9] || '') : '', unit: unit, total: total };\n` +
  `    const jaTem = alvo.itens.findIndex(x => String(x.no) === String(itemNo));\n` +
  `    if (jaTem >= 0) alvo.itens[jaTem] = reg; else alvo.itens.push(reg);\n` +
  `    if (c[8]) alvo.frete = String(c[8]);\n` +
  `    if (c[7]) alvo.prazo = String(c[7]);\n` +
  `  }\n` +
  `  const blocos = [];\n` +
  `  for (const ped of Object.keys(porPedido).sort((a, b) => Number(b) - Number(a)).slice(0, 6)) {\n` +
  `    const fornecs = porPedido[ped];\n` +
  `    const linhas = ['### Pedido ' + ped];\n` +
  `    const resumo = [];\n` +
  `    for (const forn of Object.keys(fornecs)) {\n` +
  `      const f = fornecs[forn];\n` +
  `      let mat = 0, incompleto = false;\n` +
  `      const det = [];\n` +
  `      for (const it of f.itens) {\n` +
  `        if (it.total === null) { incompleto = true; det.push('    - item ' + it.no + ' ' + it.desc + ': preco nao reconhecido'); continue; }\n` +
  `        mat += it.total;\n` +
  `        det.push('    - item ' + it.no + ' ' + it.desc + ': ' + ((it.qtd !== null && it.unit !== null) ? (it.qtd + ' x ' + brl(it.unit) + ' = ') : '') + brl(it.total));\n` +
  `      }\n` +
  `      const ftxt = f.frete || '';\n` +
  `      let frete = 0, fnota = 'nao informado';\n` +
  `      if (/inclus|gr[aá]tis|isent|sem frete|\\bcif\\b/i.test(ftxt)) { frete = 0; fnota = 'incluso'; }\n` +
  `      else {\n` +
  `        const fv = nBR((ftxt.match(/[\\d][\\d.,]*/) || [])[0]);\n` +
  `        if (fv !== null) {\n` +
  `          let mult = 1, nota = 'por entrega';\n` +
  `          if (/viagem|caminh/i.test(ftxt)) {\n` +
  `            const itV = f.itens.find(i => /caminh|viagem/i.test(i.unid || '') || /caminh/i.test(i.desc));\n` +
  `            if (itV && itV.qtd) { mult = itV.qtd; nota = 'por viagem x ' + itV.qtd; }\n` +
  `          }\n` +
  `          frete = fv * mult; fnota = brl(fv) + ' ' + nota;\n` +
  `        }\n` +
  `      }\n` +
  `      linhas.push('- ' + forn + ': materiais ' + brl(mat) + ' | frete ' + brl(frete) + ' (' + fnota + ') | TOTAL ' + brl(mat + frete) + (f.prazo ? ' | prazo: ' + f.prazo : '') + (incompleto ? ' | ATENCAO: item sem preco' : ''));\n` +
  `      for (const d of det) linhas.push(d);\n` +
  `      resumo.push({ forn: forn, total: mat + frete, assinatura: f.itens.map(i => i.no).sort().join(','), incompleto: incompleto });\n` +
  `    }\n` +
  `    const grupos = {};\n` +
  `    for (const r of resumo) (grupos[r.assinatura] = grupos[r.assinatura] || []).push(r);\n` +
  `    for (const k of Object.keys(grupos)) {\n` +
  `      const g = grupos[k].filter(x => !x.incompleto);\n` +
  `      if (g.length >= 2) {\n` +
  `        g.sort((a, b) => a.total - b.total);\n` +
  `        linhas.push('=> MENOR TOTAL (itens ' + k + '): ' + g[0].forn + ' com ' + brl(g[0].total) + ' — diferenca de ' + brl(g[1].total - g[0].total) + ' para o segundo (' + g[1].forn + ', ' + brl(g[1].total) + ')');\n` +
  `      } else if (grupos[k].length === 1) {\n` +
  `        linhas.push('=> itens ' + k + ': so ' + grupos[k][0].forn + ' cotou — sem comparacao possivel ainda');\n` +
  `      }\n` +
  `    }\n` +
  `    blocos.push(linhas.join('\\n'));\n` +
  `  }\n` +
  `  comparativo = blocos.join('\\n\\n');\n` +
  `}\n` +
  // --- referencia de precos: filtra por palavra-inteira da mensagem (nao substring) ---
  `const PRECOS = ${JSON.stringify(precoIndex)};\n` +
  `const semAcento = (s) => String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^A-Za-z0-9\\s]/g,' ').toUpperCase();\n` +
  // stopwords: palavras do PEDIDO, nao do material (evita casar servico/frete etc)
  `const STOP = new Set(('PRE ORCAMENTO ORCAR ESTIMATIVA ESTIMAR PRECO PRECOS VALOR VALORES CUSTO CUSTA CUSTAM QUANTO QUANTA SAI CHEIRO IDEIA MEDIA MEDIANA FAIXA SACO SACOS LATA LATAS ROLO ROLOS PAR PARES BARRA BARRAS UNIDADE UNIDADES CAIXA CAIXAS METRO METROS TONELADA TONELADAS CAMINHAO CAMINHOES MANDA MANDE PRECISO PRECISA QUERO QUER FAZER FAVOR PARA COM DAS DOS UMA UNS UM DE DA DO NAO SIM TEM AGORA OBRA').split(' '));\n` +
  `const msgKws = [...new Set(semAcento(req.mensagem).split(/\\s+/)\n` +
  `  .filter(w => w.length >= 4 && !/^\\d/.test(w) && !STOP.has(w)))];\n` +
  `const stem = (w) => w.length >= 5 ? w.slice(0, 5) : w;\n` +
  `const bate = (descWords, k) => descWords.some(w => w === k || (w.length >= 5 && k.length >= 5 && w.slice(0,5) === k.slice(0,5)));\n` +
  `let scored = msgKws.length ? PRECOS.map(p => {\n` +
  `    if (p[7] === 'SERVIÇOS') return { p, s: 0 };\n` + // servico nao e material p/ pre-orcamento
  `    const dw = semAcento(p[0]).split(/\\s+/); let s = 0;\n` +
  `    for (const k of msgKws) if (bate(dw, k)) s++;\n` +
  `    return { p, s };\n` +
  `  }).filter(x => x.s > 0).sort((a,b) => b.s - a.s || b.p[5] - a.p[5]) : [];\n` +
  // diversidade: 1 representativo (mais comprado) por "cabeca" de material (2 primeiras palavras),
  // para uma variante nao lotar as vagas e expulsar outro material da lista
  `const vistos = {}; const div = [];\n` +
  `for (const x of scored) {\n` +
  `  const head = semAcento(x.p[0]).split(/\\s+/).slice(0, 2).join(' ');\n` +
  `  if (vistos[head]) continue; vistos[head] = 1; div.push(x);\n` +
  `  if (div.length >= 12) break;\n` +
  `}\n` +
  `scored = div;\n` +
  `const refPrecos = scored.length\n` +
  `  ? scored.map(x => { const p = x.p; return p[0] + ' | ' + p[1] + ' | mediana R$ ' + p[2] + ' | faixa ' + p[3] + '-' + p[4] + ' | ' + p[5] + ' compras | ref ' + p[6]; }).join('\\n')\n` +
  `  : '(nenhum item citado tem historico de preco — ou a pergunta nao pediu preco)';\n` +
  `const hist = req.historico.map(h => (h.de === 'bella' ? 'Bella: ' : 'Usuario: ') + h.texto).join('\\n');\n` +
  `const prompt = ${JSON.stringify(SYSTEM)} +\n` +
  `  '\\n\\nDADOS AO VIVO (planilha de compras):\\n' + dados +\n` +
  `  (catsValidas ? '\\n\\nCATEGORIAS VALIDAS (aba REQUISITOS) — ao registrar um pedido, a categoria de cada item TEM de ser uma destas, copiada com a grafia exata (com acento). E o que liga o item ao fornecedor certo; categoria fora da lista faz o pedido cair no fornecedor GERAL:\\n' + catsValidas : '') +\n` +
  `  (comparativo ? '\\n\\nCOMPARATIVO CALCULADO PELO SISTEMA (numeros ja somados e conferidos pelo codigo — USE EXCLUSIVAMENTE estes valores; NUNCA refaca a soma nem escolha o vencedor por conta propria):\\n' + comparativo : '') +\n` +
  `  '\\n\\nREFERENCIA DE PRECOS (historico, use SO para pre-orcamento/estimativa; mediana e o valor a citar):\\n' + refPrecos +\n` +
  `  (docIndice ? '\\n\\nINDICE DE DOCUMENTOS CADASTRADOS (todas as obras — apenas titulos; o conteudo integral vem abaixo so para as obras em foco). Se pedirem memorial/documento sem citar obra, ou de obra sem documento carregado, use este indice: diga o que existe e pergunte de qual obra a pessoa quer — o conteudo carrega quando a obra e citada na conversa:\\n' + docIndice : '') +\n` +
  `  (docTxt ? '\\n\\nDOCUMENTOS DAS OBRAS (fonte oficial de especificacoes/acabamentos — priorize sobre conhecimento geral). ATENCAO CRITICA: cada documento comeca com [OBRA: X]. Ao responder sobre uma obra, use EXCLUSIVAMENTE documentos daquela obra; NUNCA atribua conteudo de um documento de uma obra a outra. Se a obra perguntada nao tem documento aqui, diga que ainda nao tem o documento dela. Pedido de LISTA/TABELA/RESUMO de materiais de um documento: ATENDA usando o conteudo do documento, formatado como lista <ul><li> (tabela nao existe no chat — entregue lista organizada; NUNCA recuse por causa do formato):\\n' + docTxt : '') +\n` +
  `  '\\n\\nQUEM ESTA FALANDO COM VOCE: ' + (quem.nome ? quem.nome + ' (' + quem.papel + ')' : 'nao identificado') +\n` +
  `  '\\nFale DIRETAMENTE com essa pessoa, na segunda pessoa. Se alguma regra citar essa mesma pessoa pelo nome (ex.: Daniela), aplique em segunda pessoa: para a propria Daniela diga: a decisao e sua / voce ja consegue ver — NUNCA fale dela em terceira pessoa com ela mesma.' +\n` +
  `  '\\n\\nOBRA ATUAL DO USUARIO: ' + (req.obra || quem.obra || 'nao informada') +\n` +
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
  `  generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },\n` +
  `};\n` +
  `return [{ json: { autorizado: true, obraEfetiva: req.obra || quem.obra || '', quemNome: quem.nome || '', payload } }];\n`;

const jsProcessar =
  `let resposta = 'Opa, me embolei aqui. Pode repetir, por favor?';\n` +
  `let transcricao = '';\nlet acao = null;\nlet acaoReg = null;\nlet acaoCob = null;\n` +
  `try {\n` +
  `  const txt = $json.candidates[0].content.parts[0].text;\n` +
  `  const obj = JSON.parse(txt);\n` +
  `  if (obj && obj.resposta) resposta = String(obj.resposta);\n` +
  `  if (obj && obj.transcricao) transcricao = String(obj.transcricao);\n` +
  `  if (obj && obj.acao && obj.acao.tipo === 'cotacao_email') acao = obj.acao;\n` +
  `  if (obj && obj.acao && obj.acao.tipo === 'registrar_pedido') acaoReg = obj.acao;\n` +
  `  if (obj && obj.acao && obj.acao.tipo === 'cobranca_email') acaoCob = obj.acao;\n` +
  `} catch (e) {}\n` +
  // corpo de e-mail é texto puro: remove tags HTML que o LLM deixar vazar
  `const txtPuro = (s) => String(s).replace(/<br\\s*\\/?>/gi, '\\n').replace(/<li[^>]*>/gi, '\\n- ').replace(/<\\/(ul|ol|p|li)>/gi, '\\n').replace(/<[^>]+>/g, '').replace(/\\n{3,}/g, '\\n\\n');\n` +
  // guarda anti-alucinação: endereço de e-mail na resposta que não existe nas
  // tabelas (FORNECEDORES, REMETENTE da fila, Daniela, Bella) é neutralizado
  `const vrT = ($('Ler dados').first().json.valueRanges) || [];\n` +
  `const emailsOk = new Set(['ssysbot@gmail.com', ${JSON.stringify(EMAIL_DANIELA)}]);\n` +
  `for (const f of ((vrT[7] && vrT[7].values) || []).slice(1)) if (/@/.test(String(f[2] || ''))) emailsOk.add(String(f[2]).trim().toLowerCase());\n` +
  `for (const p of ((vrT[4] && vrT[4].values) || []).slice(1)) if (/@/.test(String(p[2] || ''))) emailsOk.add(String(p[2]).trim().toLowerCase());\n` +
  `resposta = resposta.replace(/[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+/g, (m) => emailsOk.has(m.toLowerCase()) ? m : '(e-mail nao cadastrado)');\n` +
  // valida destinatarios contra a aba FORNECEDORES (anti-alucinacao de e-mail)
  `let envios = [];\nlet marcar = null;\n` +
  `if (acao) {\n` +
  `  const vrx = ($('Ler dados').first().json.valueRanges) || [];\n` +
  `  const forn = ((vrx[7] && vrx[7].values) || []).slice(1);\n` +
  `  const assunto = String(acao.assunto || 'Cotacao - Prisbel Construtora').slice(0, 150);\n` +
  `  const corpoBase = txtPuro(acao.corpo || '').slice(0, 5000);\n` +
  // casa por NOME do fornecedor e usa o e-mail DA TABELA (nunca o do LLM);
  // indexar por e-mail falhava quando fornecedores compartilham o mesmo e-mail
  `  const vistos = {};\n` +
  `  for (const d of (Array.isArray(acao.destinatarios) ? acao.destinatarios.slice(0, 10) : [])) {\n` +
  `    const alvo = String(d.nome || '').trim().toLowerCase();\n` +
  `    if (!alvo) continue;\n` +
  `    const row = forn.find(f => String(f[1] || '').trim().toLowerCase() === alvo)\n` +
  `      || forn.find(f => String(f[1] || '').trim().toLowerCase().indexOf(alvo) >= 0)\n` +
  `      || forn.find(f => alvo.indexOf(String(f[1] || '').trim().toLowerCase()) >= 0 && String(f[1] || '').trim());\n` +
  `    if (!row || !row[2] || !/@/.test(String(row[2]))) continue;\n` +
  `    const nome = String(row[1]).trim();\n` +
  `    if (vistos[nome.toLowerCase()]) continue;\n` +
  `    vistos[nome.toLowerCase()] = 1;\n` +
  `    envios.push({ sendTo: String(row[2]).trim(), assunto, nome, corpo: corpoBase.split('{FORNECEDOR}').join(nome) });\n` +
  `  }\n` +
  `  if (!envios.length) resposta = 'Nao encontrei e-mail cadastrado para esses fornecedores na aba FORNECEDORES. Confere o cadastro no Admin, por favor? 🙏';\n` +
  // TRAVA DETERMINÍSTICA: sem proposta prévia da Bella no histórico, o envio vira proposta
  `  if (envios.length) {\n` +
  `    const histReq = ($('Validar').first().json.historico) || [];\n` +
  `    const propostaPrevia = histReq.some(h => h.de === 'bella' && /cota/i.test(h.texto || '') && /(posso enviar|posso mandar|confirma|aprovar? o envio|pode ser\\?)/i.test(h.texto || ''));\n` +
  `    if (!propostaPrevia) {\n` +
  `      const nomes = envios.map(e => '<b>' + e.nome + '</b>').join(', ');\n` +
  `      resposta = 'Preparei a cotacao para: ' + nomes + '.<br>Itens: ' + String(acao.corpo || '').split('\\n').filter(l => l.trim().indexOf('-') === 0).join(' · ').slice(0, 400) + '<br><b>Posso enviar?</b>';\n` +
  `      envios = [];\n` +
  `    }\n` +
  `  }\n` +
  // envio confirmado: marca o pedido como EM COTACAO na fila (mesmo efeito do painel)
  `  if (envios.length) {\n` +
  `    const numCot = parseInt((String(acao.assunto || '').match(/(\\d+)/) || [])[1], 10);\n` +
  `    if (numCot) {\n` +
  `      const linhasCot = ((vrx[4] && vrx[4].values) || []).map((r, i) => ({ r, i })).filter(x => x.i > 0 && parseInt(x.r[0], 10) === numCot);\n` +
  `      if (linhasCot.length) marcar = { url: 'https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate', corpo: { valueInputOption: 'RAW', data: linhasCot.map(x => ({ range: 'PEDIDOS!L' + (x.i + 1), values: [['EM COTAÇÃO']] })) } };\n` +
  `    }\n` +
  `  }\n` +
  `}\n` +
  // cobrança de pendência: destinatário SEMPRE da coluna REMETENTE da fila (nunca do LLM),
  // com cópia automática para a Daniela; mesma trava determinística de proposta prévia
  // guarda: cobranca so vale com numero de pedido REAL; sem isso um 'pode registrar' mal interpretado virava 'nao encontrei o pedido N pra cobrar'
  `if (acaoCob && !/^\\d+$/.test(String(acaoCob.pedido || '').trim())) acaoCob = null;\n` +
  `if (acaoCob) {\n` +
  `  const CC_DANIELA = ${JSON.stringify(EMAIL_DANIELA)};\n` +
  `  const vrc = ($('Ler dados').first().json.valueRanges) || [];\n` +
  `  const pedc = ((vrc[4] && vrc[4].values) || []).slice(1);\n` +
  `  const numC = parseInt(acaoCob.pedido, 10);\n` +
  `  const rowsC = pedc.filter(r => parseInt(r[0], 10) === numC);\n` +
  `  const destC = rowsC.length ? String(rowsC[0][2] || '').trim() : '';\n` +
  `  if (!rowsC.length) resposta = 'Nao encontrei o pedido ' + (acaoCob.pedido || '?') + ' na fila pra cobrar. Confere o numero pra mim?';\n` +
  `  else if (destC.indexOf('@') < 0) resposta = 'O pedido ' + numC + ' foi registrado via ' + (destC || 'chat') + (rowsC[0][3] ? ' por <b>' + rowsC[0][3] + '</b>' : '') + ', entao nao tenho e-mail do solicitante pra cobrar. Vale falar com ele direto, ta?';\n` +
  `  else {\n` +
  `    const histC = ($('Validar').first().json.historico) || [];\n` +
  `    const propostaCob = histC.some(h => h.de === 'bella' && /(cobran|pendenc|lembrete)/i.test(h.texto || '') && /(posso enviar|posso mandar|confirma|pode ser\\?)/i.test(h.texto || ''));\n` +
  `    if (!propostaCob) {\n` +
  `      const pendTxtC = rowsC.map(r => '- ' + String(r[7] || '').slice(0, 80) + (r[12] ? ' (falta: ' + r[12] + ')' : '')).join('<br>').slice(0, 500);\n` +
  `      resposta = 'Preparei a cobranca do pedido ' + numC + ' para <b>' + destC + '</b> (solicitante registrado), com copia pra Daniela.<br>' + pendTxtC + '<br><b>Posso enviar?</b>';\n` +
  `    } else {\n` +
  `      envios.push({ sendTo: destC, cc: CC_DANIELA, tipoEnvio: 'cobranca', nome: destC,\n` +
  `        assunto: String(acaoCob.assunto || ('Pedido ' + numC + ' - informacoes pendentes - Prisbel Construtora')).slice(0, 150),\n` +
  `        corpo: txtPuro(acaoCob.corpo || '').slice(0, 5000) });\n` +
  `    }\n` +
  `  }\n` +
  `}\n` +
  // registro do pedido na fila PEDIDOS (numero sequencial + linhas por item)
  // TRAVA ANTI-DUPLICATA: se ESTA conversa ja registrou um pedido e os itens novos
  // sobrepoem os dele, ATUALIZA o pedido existente em vez de criar outro numero
  // (cobre o registro parcial prematuro do LLM e o reenvio por rede lenta)
  `let registro = null;\n` +
  // TRAVA: registro parcial. Se a própria resposta ainda pede informação que
  // falta, o pedido NÃO entra na fila — senão nasce um pedido incompleto e o
  // seguinte vira duplicata. (Regra de prompt sozinha não segurou.)
  `if (acaoReg && /(ainda\\s+)?preciso\\s+(d[eoa]|que|saber)|falta(m|ndo)?\\s+(s[oó]\\s+|ainda\\s+)?(a|o|as|os|informar|saber)|me\\s+(passa|informa|diz|confirma)\\s|assim\\s+que\\s+(voc[eê]|me)\\s/i.test(resposta)\n` +
  `    && !/registrad|atualizad/i.test(resposta)) {\n` +
  `  acaoReg = null;\n` +
  `}\n` +
  `if (acaoReg && Array.isArray(acaoReg.itens) && acaoReg.itens.length) {\n` +
  `  const vrx2 = ($('Ler dados').first().json.valueRanges) || [];\n` +
  `  const linhasPed = ((vrx2[4] && vrx2[4].values) || []);\n` +
  `  const ped = linhasPed.slice(1);\n` +
  `  let maxN = 0;\n` +
  `  for (const r of ped) { const n = parseInt(r[0], 10); if (n > maxN) maxN = n; }\n` +
  `  let num = maxN + 1;\n` +
  `  let modo = 'novo';\n` +
  `  const histR = ($('Validar').first().json.historico) || [];\n` +
  `  let numPrev = 0;\n` +
  `  for (const h of histR) {\n` +
  `    if (h.de !== 'bella') continue;\n` +
  `    const t = String(h.texto || '');\n` +
  `    const m = t.match(/pedido\\s*(?:n[o\\u00ba\\u00b0\\u00b0.]{0,2}\\s*)?(\\d+)\\s*(?:registrad|atualizad)/i) || t.match(/\\uD83D\\uDCCB Pedido n\\u00ba (\\d+)/) || t.match(/\\uD83D\\uDD04 Pedido n\\u00ba (\\d+)/);\n` +
  `    if (m) numPrev = parseInt(m[1], 10);\n` +
  `  }\n` +
  `  let rowsPrev = [];\n` +
  `  if (numPrev) {\n` +
  `    linhasPed.forEach((r, i) => { if (i > 0 && parseInt(r[0], 10) === numPrev) rowsPrev.push({ r, linha: i + 1 }); });\n` +
  `    if (rowsPrev.length) {\n` +
  `      const norm = (s) => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z\\s]/g, ' ');\n` +
  `      const toks = (s) => new Set(norm(s).split(/\\s+/).filter(w => w.length >= 5));\n` +
  `      const casa = (a, b) => { for (const w of a) if (b.has(w)) return true; return false; };\n` +
  `      const prevToks = rowsPrev.map(x => toks(x.r[7]));\n` +
  `      let iguais = 0;\n` +
  `      for (const it of acaoReg.itens) { const tn = toks(it.item); if (prevToks.some(p => casa(tn, p))) iguais++; }\n` +
  `      if (iguais >= Math.ceil(acaoReg.itens.length / 2)) { modo = 'update'; num = numPrev; }\n` +
  `    }\n` +
  `  }\n` +
  `  const mont = $('Montar prompt').first().json;\n` +
  `  const ag = new Date();\n` +
  `  const dh = ('0'+ag.getDate()).slice(-2)+'/'+('0'+(ag.getMonth()+1)).slice(-2)+'/'+ag.getFullYear()+' '+('0'+ag.getHours()).slice(-2)+':'+('0'+ag.getMinutes()).slice(-2);\n` +
  `  const urg = String(acaoReg.urgente || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NÃO';\n` +
  `  const values = acaoReg.itens.slice(0, 20).map((it, i) => [\n` +
  `    num, dh, 'chat', String(mont.quemNome || ''), String(mont.obraEfetiva || ''), urg,\n` +
  `    String(acaoReg.motivo_urgencia || '').slice(0, 120), String(it.item || '').slice(0, 250),\n` +
  `    (it.quant === null || it.quant === undefined || it.quant === '') ? '' : it.quant,\n` +
  `    String(it.unid || '').slice(0, 20), String(it.categoria || 'GERAL').slice(0, 40),\n` +
  `    'COMPLETO', '', 'chat-' + Date.now(), 'registrado via chat', i + 1,\n` +
  `  ]);\n` +
  `  if (modo === 'update') {\n` +
  `    const data = [];\n` +
  `    const ate = Math.min(values.length, rowsPrev.length);\n` +
  `    for (let i = 0; i < ate; i++) data.push({ range: 'PEDIDOS!A' + rowsPrev[i].linha + ':P' + rowsPrev[i].linha, values: [values[i]] });\n` +
  `    let prox = linhasPed.length + 1;\n` +
  `    for (let i = ate; i < values.length; i++) data.push({ range: 'PEDIDOS!A' + prox + ':P' + prox, values: [values[i]] }), prox++;\n` +
  `    for (let i = ate; i < rowsPrev.length; i++) data.push({ range: 'PEDIDOS!A' + rowsPrev[i].linha + ':P' + rowsPrev[i].linha, values: [['','','','','','','','','','','','','','','','']] });\n` +
  `    registro = { num, url: 'https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate', corpo: { valueInputOption: 'USER_ENTERED', data } };\n` +
  `  } else {\n` +
  `    registro = { num, url: 'https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PEDIDOS!A1:append?valueInputOption=USER_ENTERED', corpo: { values } };\n` +
  `  }\n` +
  `  resposta = resposta.replace(/\\{\\s*NUMERO\\s*\\}/gi, num).replace(/\\{\\s*\\d+\\s*\\}/g, num);\n` +
  `  if (modo === 'update' && !/atualizad/i.test(resposta)) resposta += '<br>🔄 Pedido nº ' + num + ' atualizado — sem duplicar.';\n` +
  `  else if (resposta.indexOf(String(num)) < 0) resposta += '<br>📋 Pedido nº ' + num + '.';\n` +
  `}\n` +
  // HONESTIDADE: o LLM às vezes escreve "Pedido {NUMERO} registrado!" sem emitir
  // a ação — o usuário via a confirmação e nada entrava na fila. Sem registro,
  // a frase de confirmação é removida e vira pedido de confirmação.
  `if (!registro && /\\{\\s*NUMERO\\s*\\}/i.test(resposta)) {\n` +
  `  resposta = resposta.replace(/\\{\\s*NUMERO\\s*\\}/gi, '')\n` +
  `    .replace(/pedido\\s+n?[\\u00ba\\u00b0o]?\\s*registrado!?/gi, '')\n` +
  `    .replace(/\\s{2,}/g, ' ').trim();\n` +
  `  resposta += '<br><b>Confirma que posso registrar assim?</b>';\n` +
  `}\n` +
  `return [{ json: { resposta, transcricao, envios, registro, marcar } }];\n`;

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
    { name: 'Ler acessos pg', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [150, -160],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=ACESSOS!A2:H200&ranges=CONVERSAS!A2:G3000&ranges=PEDIDOS!A2:P300`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    { name: 'Servir protótipo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [320, -160],
      parameters: { jsCode: jsServe } },
    { name: 'Responder página', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, -160],
      parameters: { respondWith: 'text', responseBody: '={{ $json.html }}',
        options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }] } } } },
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
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=OBRAS!A1:G20&ranges=PESSOAS!A1:G30&ranges=CONTRATOS_COMPRAS!A1:O80&ranges=FATOS!A1:G80&ranges=PEDIDOS!A1:P300&ranges=ACESSOS!A2:H200&ranges=DOCUMENTOS!A2:H500&ranges=FORNECEDORES!A1:D60&ranges=COTACOES!A1:N300&ranges=REQUISITOS!A1:E60`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    { name: 'Montar prompt', type: 'n8n-nodes-base.code', typeVersion: 2, position: [780, 40],
      parameters: { jsCode: jsMontar } },
    { name: 'Autorizado?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [880, 40],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-aut', leftValue: "={{ $json.autorizado === false ? 'nao' : 'sim' }}", rightValue: 'sim',
          operator: { type: 'string', operation: 'equals' } }],
      } } },
    { name: 'Gemini', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1040, 40],
      executeOnce: true,
      parameters: { method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.payload) }}', options: {} },
      credentials: { httpHeaderAuth: { id: 'MgtrdiyIibEc7OYw', name: 'Gemini' } } },
    { name: 'Processar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1180, 40],
      parameters: { jsCode: jsProcessar } },
    { name: 'Prep salvar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1280, 140],
      parameters: { jsCode: "const req = $('Validar').first().json;\nconst proc = $json;\nconst obraEf = ($('Montar prompt').first().json.obraEfetiva) || req.obra || '';\nconst msgUser = req.audio ? (proc.transcricao || '(audio)') : req.mensagem;\nlet cid = String(req.conversa_id || '');\nif (!/^c[0-9]{8,}$/.test(cid)) cid = 'c' + Date.now();\nconst ts = new Date().toISOString();\nconst titulo = String(req.titulo || msgUser || 'Conversa').replace(/\\s+/g, ' ').slice(0, 60);\nconst values = [\n  [cid, req.t, titulo, ts, obraEf, 'usuario', String(msgUser || '').slice(0, 3000)],\n  [cid, req.t, titulo, ts, obraEf, 'bella', String(proc.resposta || '').slice(0, 5000)],\n];\nreturn [{ json: { conversa_id: cid, url: \"https://sheets.googleapis.com/v4/spreadsheets/SHEETID/values/CONVERSAS!A1:append?valueInputOption=RAW\", corpo: { values } } }];".split('SHEETID').join(SHEET_ID) } },
    { name: 'Tem registro?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1480, 240],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-reg', leftValue: "={{ $('Processar').first().json.registro ? 'sim' : 'nao' }}", rightValue: 'sim',
          operator: { type: 'string', operation: 'equals' } }],
      } } },
    { name: 'Gravar PEDIDOS', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1580, 300],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: 'POST', url: "={{ $('Processar').first().json.registro.url }}",
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify($('Processar').first().json.registro.corpo) }}", options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    { name: 'Gravar CONVERSAS', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1380, 140],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      parameters: { method: 'POST', url: '={{ $json.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.corpo) }}', options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    { name: 'Tem envio?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1380, 40],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-env', leftValue: "={{ ($('Processar').first().json.envios || []).length > 0 ? 'sim' : 'nao' }}", rightValue: 'sim',
          operator: { type: 'string', operation: 'equals' } }],
      } } },
    { name: 'Separar envios', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1580, -60],
      parameters: { jsCode: 'return $(\'Processar\').first().json.envios.map(e => ({ json: e }));' } },
    { name: 'Enviar e-mails', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1780, -60],
      onError: 'continueRegularOutput',
      parameters: { operation: 'send', sendTo: '={{ $json.sendTo }}', subject: '={{ $json.assunto }}',
        emailType: 'text', message: '={{ $json.corpo }}', options: { appendAttribution: false, ccList: "={{ $json.cc || '' }}" } },
      credentials: { gmailOAuth2: { id: 'WhxkPdGziEvCRIqD', name: 'Gmail ssysbot' } } },
    { name: 'Confirmar envio', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1980, -60],
      parameters: { jsCode: "const pedidos = $('Separar envios').all().map(i => i.json);\nconst results = $input.all();\nconst ok = [], falha = [];\nlet cobranca = false;\nresults.forEach((r, i) => { const e = pedidos[i] || {}; const nome = e.nome || '?'; if (r.json && r.json.error) falha.push(nome); else { ok.push(nome); if (e.tipoEnvio === 'cobranca') cobranca = true; } });\nlet resposta = '';\nif (ok.length && cobranca) resposta += '📧 Cobrança enviada para <b>' + ok.join('</b>, <b>') + '</b>, com cópia para a Daniela. Assim que responderem, eu completo o pedido. 😉';\nelse if (ok.length) resposta += '📧 Cotação enviada para: <b>' + ok.join('</b>, <b>') + '</b>.<br>Assim que os fornecedores responderem, a Daniela avalia as propostas. 😉';\nif (falha.length) resposta += '<br>⚠ Falhou para: ' + falha.join(', ') + ' — tente de novo em instantes.';\nreturn [{ json: { resposta } }];" } },
    { name: 'Marcou?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [2100, -60],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'c-mar', leftValue: "={{ $('Processar').first().json.marcar ? 'sim' : 'nao' }}", rightValue: 'sim',
          operator: { type: 'string', operation: 'equals' } }],
      } } },
    { name: 'Marcar EM COTACAO', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2220, -120],
      executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput',
      retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
      parameters: { method: 'POST', url: "={{ $('Processar').first().json.marcar.url }}",
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify($('Processar').first().json.marcar.corpo) }}", options: {} },
      credentials: { googleSheetsOAuth2Api: { id: 'UtfOFU26GNbDmApU', name: 'Google Sheets' } } },
    respondJson('Responder API', "={{ JSON.stringify({resposta: $('Processar').first().json.resposta, transcricao: $('Processar').first().json.transcricao || undefined, conversa_id: $('Prep salvar').first().json.conversa_id}) }}", [1580, 140]),
    respondJson('Responder negado', JSON.stringify({ resposta: 'Acesso negado.' }), [580, 220]),
    respondJson('Responder enviado', "={{ JSON.stringify({resposta: $('Confirmar envio').first().json.resposta, conversa_id: $('Prep salvar').first().json.conversa_id}) }}", [2380, -60]),
    respondJson('Responder expirado', JSON.stringify({ resposta: 'Seu acesso à Bella expirou ou foi desativado. Fala com o Eduardo pra renovar, tá? 🙏' }), [1040, 220]),
  ],
  connections: {
    'Página': { main: [[{ node: 'Ler acessos pg', type: 'main', index: 0 }]] },
    'Ler acessos pg': { main: [[{ node: 'Servir protótipo', type: 'main', index: 0 }]] },
    'Servir protótipo': { main: [[{ node: 'Responder página', type: 'main', index: 0 }]] },
    'API Chat': { main: [[{ node: 'Validar', type: 'main', index: 0 }]] },
    'Validar': { main: [[{ node: 'Token ok?', type: 'main', index: 0 }]] },
    'Token ok?': { main: [
      [{ node: 'Ler dados', type: 'main', index: 0 }],
      [{ node: 'Responder negado', type: 'main', index: 0 }],
    ] },
    'Ler dados': { main: [[{ node: 'Montar prompt', type: 'main', index: 0 }]] },
    'Montar prompt': { main: [[{ node: 'Autorizado?', type: 'main', index: 0 }]] },
    'Autorizado?': { main: [
      [{ node: 'Gemini', type: 'main', index: 0 }],
      [{ node: 'Responder expirado', type: 'main', index: 0 }],
    ] },
    'Gemini': { main: [[{ node: 'Processar', type: 'main', index: 0 }]] },
    'Processar': { main: [[{ node: 'Prep salvar', type: 'main', index: 0 }]] },
    'Prep salvar': { main: [[{ node: 'Gravar CONVERSAS', type: 'main', index: 0 }]] },
    'Gravar CONVERSAS': { main: [[{ node: 'Tem registro?', type: 'main', index: 0 }]] },
    'Tem registro?': { main: [
      [{ node: 'Gravar PEDIDOS', type: 'main', index: 0 }],
      [{ node: 'Tem envio?', type: 'main', index: 0 }],
    ] },
    'Gravar PEDIDOS': { main: [[{ node: 'Tem envio?', type: 'main', index: 0 }]] },
    'Tem envio?': { main: [
      [{ node: 'Separar envios', type: 'main', index: 0 }],
      [{ node: 'Responder API', type: 'main', index: 0 }],
    ] },
    'Separar envios': { main: [[{ node: 'Enviar e-mails', type: 'main', index: 0 }]] },
    'Enviar e-mails': { main: [[{ node: 'Confirmar envio', type: 'main', index: 0 }]] },
    'Confirmar envio': { main: [[{ node: 'Marcou?', type: 'main', index: 0 }]] },
    'Marcou?': { main: [
      [{ node: 'Marcar EM COTACAO', type: 'main', index: 0 }],
      [{ node: 'Responder enviado', type: 'main', index: 0 }],
    ] },
    'Marcar EM COTACAO': { main: [[{ node: 'Responder enviado', type: 'main', index: 0 }]] },
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
console.log(`página → HTTP ${pageRes.status}, v0.9: ${(await pageRes.text()).includes('v0.9')}`);
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
