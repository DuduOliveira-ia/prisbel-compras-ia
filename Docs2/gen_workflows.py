# -*- coding: utf-8 -*-
"""Gera os JSONs importáveis no n8n: WF1 (alerta diário) e WF2 (recepção de respostas)."""
import json, uuid

def nid():
    return str(uuid.uuid4())

# ============================================================ WF1
CODE_SELECAO = r"""
// ===== Seleção de contratos e montagem da mensagem =====
const TZ = 'America/Sao_Paulo';
const cfg = $('Config').first().json;

const contratos = $('Ler CONTRATOS').all().map(i => i.json);
const logRows = $('Ler LOG').all().map(i => i.json);

const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const dd = String(hoje.getDate()).padStart(2, '0');
const mm = String(hoje.getMonth() + 1).padStart(2, '0');
const hojeStr = `${dd}/${mm}/${hoje.getFullYear()}`;

// Idempotência: contratos já alertados hoje (LOG)
const alertadosHoje = new Set();
for (const r of logRows) {
  const dt = String(r['DATA/HORA'] || '');
  if (String(r['EVENTO']) === 'ALERTA ENVIADO' && dt.startsWith(hojeStr)) {
    String(r['ID CONTRATO'] || '').split(',').forEach(id => alertadosHoje.add(id.trim()));
  }
}

const ATIVOS = ['ALERTAR', 'VENCIDO', 'DEVOLVER'];
const alertas = [];
const incompletos = [];

for (const c of contratos) {
  const id = String(c['ID'] || '').trim();
  if (!id) continue;
  const cadastro = String(c['CADASTRO'] || '').trim();
  const status = String(c['STATUS ALERTA'] || '').trim();
  if (cadastro.startsWith('FALTA')) { incompletos.push(c); continue; }
  if (cadastro === 'OK' && ATIVOS.includes(status) && !alertadosHoje.has(id)) alertas.push(c);
}

if (alertas.length === 0 && incompletos.length === 0) return []; // nada a fazer — encerra o fluxo

// Ordena por obra e por dias p/ vencer
alertas.sort((a, b) =>
  String(a['OBRA *']).localeCompare(String(b['OBRA *'])) ||
  (Number(a['DIAS P/ VENCER']) || 999) - (Number(b['DIAS P/ VENCER']) || 999));

const fmtMoeda = v => 'R$ ' + Number(String(v).replace(',', '.') || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

let texto = `\u{1F514} LOCAÇÕES — ${hojeStr}\n`;
const mapa = [];
let n = 0, obraAtual = null;
for (const c of alertas) {
  const obra = String(c['OBRA *']);
  if (obra !== obraAtual) { texto += `\n*${obra}*\n`; obraAtual = obra; }
  n++;
  const status = String(c['STATUS ALERTA']);
  const pref = status === 'DEVOLVER' ? '⚠️ ' : (status === 'VENCIDO' ? '\u{1F534} ' : '');
  texto += `${n}) ${pref}${c['EQUIPAMENTO / MATERIAL *']} — ${c['FORNECEDOR *']} (contr. ${c['Nº CONTRATO *']})\n`;
  if (status === 'DEVOLVER') {
    texto += `   Devolução solicitada — retirada ainda não confirmada\n`;
  } else {
    texto += `   Renova em ${c['PRÓXIMO VENCIMENTO']} — ${fmtMoeda(c['VALOR DO CICLO (R$) *'])}/ciclo\n`;
  }
  mapa.push({ item: n, id: String(c['ID']), contrato: String(c['Nº CONTRATO *']), equipamento: String(c['EQUIPAMENTO / MATERIAL *']) });
}

if (n > 0) {
  texto += `\nPara cada item, responda: DEVOLVER, RENOVAR ou JÁ FOI`;
  texto += `\nEx.: "1 devolver, 2 renova"`;
}

if (incompletos.length > 0) {
  texto += `\n\n⚠️ ${incompletos.length} contrato(s) FORA do monitoramento (cadastro incompleto):`;
  for (const c of incompletos) {
    texto += `\n#${c['ID']} ${c['EQUIPAMENTO / MATERIAL *'] || '(sem descrição)'} — ${c['CADASTRO']}`;
  }
}

return [{ json: {
  texto,
  mapa_itens: JSON.stringify(mapa),
  ids: mapa.map(m => m.id).join(', '),
  numero_destino: cfg.NUMERO_DANIELA,
  data_hora: `${hojeStr} ${String(hoje.getHours()).padStart(2,'0')}:${String(hoje.getMinutes()).padStart(2,'0')}`
} }];
""".strip()

CODE_LOG_WF1 = r"""
// ===== Linha de LOG do alerta enviado =====
const m = $('Selecionar e montar mensagem').first().json;
return [{ json: {
  'DATA/HORA': m.data_hora,
  'ID CONTRATO': m.ids,
  'Nº CONTRATO': '',
  'EVENTO': 'ALERTA ENVIADO',
  'DETALHE': 'MAPA_ITENS=' + m.mapa_itens + ' | ' + m.texto,
  'CANAL': 'WhatsApp',
  'AUTOR': 'Agente'
} }];
""".strip()

def sheets_read(name, aba, pos):
    return {
        "id": nid(), "name": name, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5,
        "position": pos,
        "parameters": {
            "operation": "read",
            "documentId": {"__rl": True, "value": "={{ $('Config').first().json.SHEET_ID }}", "mode": "id"},
            "sheetName": {"__rl": True, "value": aba, "mode": "name"},
            "options": {}
        },
        "credentials": {}
    }

def sheets_append(name, aba, pos):
    return {
        "id": nid(), "name": name, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5,
        "position": pos,
        "parameters": {
            "operation": "append",
            "documentId": {"__rl": True, "value": "={{ $('Config').first().json.SHEET_ID }}", "mode": "id"},
            "sheetName": {"__rl": True, "value": aba, "mode": "name"},
            "columns": {"mappingMode": "autoMapInputData", "matchingColumns": [], "schema": []},
            "options": {}
        },
        "credentials": {}
    }

config_assignments = [
    {"id": nid(), "name": "SHEET_ID", "value": "COLOQUE_AQUI_O_ID_DA_PLANILHA", "type": "string"},
    {"id": nid(), "name": "NUMERO_DANIELA", "value": "5531XXXXXXXXX", "type": "string"},
    {"id": nid(), "name": "UAZAPI_BASE", "value": "https://ssysbot.uazapi.dev", "type": "string"},
    {"id": nid(), "name": "MODEL_LLM", "value": "claude-haiku-4-5-20251001", "type": "string"},
]

wf1_nodes = [
    {"id": nid(), "name": "Diariamente 07h (seg-sex)", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
     "position": [-460, 0],
     "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 7 * * 1-5"}]}}},
    {"id": nid(), "name": "Config", "type": "n8n-nodes-base.set", "typeVersion": 3.4,
     "position": [-240, 0],
     "parameters": {"assignments": {"assignments": config_assignments}, "options": {}}},
    sheets_read("Ler CONTRATOS", "CONTRATOS", [-20, 0]),
    sheets_read("Ler LOG", "LOG", [200, 0]),
    {"id": nid(), "name": "Selecionar e montar mensagem", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [420, 0], "parameters": {"jsCode": CODE_SELECAO}},
    {"id": nid(), "name": "Enviar WhatsApp (uazapi)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
     "position": [640, 0], "onError": "continueErrorOutput", "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000,
     "parameters": {
         "method": "POST",
         "url": "={{ $('Config').first().json.UAZAPI_BASE }}/send/text",
         "authentication": "genericCredentialType",
         "genericAuthType": "httpHeaderAuth",
         "sendBody": True, "specifyBody": "json",
         "jsonBody": "={{ JSON.stringify({ number: $json.numero_destino, text: $json.texto }) }}",
         "options": {}
     },
     "credentials": {}},
    {"id": nid(), "name": "Fallback E-mail (Gmail)", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1,
     "position": [860, 160],
     "parameters": {
         "operation": "send",
         "sendTo": "compras@grupomunizrabelo.com.br",
         "subject": "=[FALLBACK] Alerta de locações — {{ $('Selecionar e montar mensagem').first().json.data_hora }}",
         "message": "={{ $('Selecionar e montar mensagem').first().json.texto }}",
         "options": {}
     },
     "credentials": {}},
    {"id": nid(), "name": "Preparar linha LOG", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [860, -100], "parameters": {"jsCode": CODE_LOG_WF1}},
    sheets_append("Gravar LOG", "LOG", [1080, -100]),
]

wf1_connections = {
    "Diariamente 07h (seg-sex)": {"main": [[{"node": "Config", "type": "main", "index": 0}]]},
    "Config": {"main": [[{"node": "Ler CONTRATOS", "type": "main", "index": 0}]]},
    "Ler CONTRATOS": {"main": [[{"node": "Ler LOG", "type": "main", "index": 0}]]},
    "Ler LOG": {"main": [[{"node": "Selecionar e montar mensagem", "type": "main", "index": 0}]]},
    "Selecionar e montar mensagem": {"main": [[{"node": "Enviar WhatsApp (uazapi)", "type": "main", "index": 0}]]},
    "Enviar WhatsApp (uazapi)": {"main": [
        [{"node": "Preparar linha LOG", "type": "main", "index": 0}],
        [{"node": "Fallback E-mail (Gmail)", "type": "main", "index": 0}]
    ]},
    "Preparar linha LOG": {"main": [[{"node": "Gravar LOG", "type": "main", "index": 0}]]},
}

wf1 = {
    "name": "Agente Locações — WF1 Alerta Diário (v1.0)",
    "nodes": wf1_nodes,
    "connections": wf1_connections,
    "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo"},
    "pinData": {}
}

# ============================================================ WF2
CODE_WHITELIST = r"""
// ===== Whitelist + extração da mensagem recebida =====
// ATENÇÃO (Ulisses): o formato do payload varia conforme a versão do uazapi.
// Rode uma mensagem de teste, olhe o JSON em Executions e ajuste os caminhos abaixo.
const cfg = $('Config').first().json;
const b = $json.body || $json;

// Tentativas comuns de extração (ajustar conforme payload real):
const remetente = String(
  b.sender || b.from || b.phone || b.message?.sender || b.data?.key?.remoteJid || ''
).replace(/\D/g, '');

const textoMsg =
  b.text || b.message?.text || b.message?.conversation ||
  b.data?.message?.conversation || b.data?.message?.extendedTextMessage?.text || '';

const fromMe = Boolean(b.fromMe || b.message?.fromMe || b.data?.key?.fromMe);

const whitelist = String(cfg.NUMERO_DANIELA).replace(/\D/g, '');

if (fromMe) return [];
if (!remetente.includes(whitelist) && !whitelist.includes(remetente)) return []; // fora da whitelist — ignora
if (!String(textoMsg).trim()) return [];

return [{ json: { remetente, texto_daniela: String(textoMsg).trim() } }];
""".strip()

CODE_CONTEXTO = r"""
// ===== Recupera o último alerta enviado (MAPA_ITENS) =====
const logRows = $('Ler LOG').all().map(i => i.json);
const alertas = logRows.filter(r => String(r['EVENTO']) === 'ALERTA ENVIADO' && String(r['DETALHE'] || '').includes('MAPA_ITENS='));
if (alertas.length === 0) {
  return [{ json: { sem_contexto: true, texto_daniela: $('Whitelist e extração').first().json.texto_daniela } }];
}
const ultimo = alertas[alertas.length - 1];
const det = String(ultimo['DETALHE']);
const jsonStr = det.substring(det.indexOf('MAPA_ITENS=') + 'MAPA_ITENS='.length, det.indexOf(' | '));
let mapa = [];
try { mapa = JSON.parse(jsonStr); } catch (e) { return [{ json: { sem_contexto: true, texto_daniela: $('Whitelist e extração').first().json.texto_daniela } }]; }
return [{ json: {
  sem_contexto: false,
  mapa_itens: mapa,
  texto_daniela: $('Whitelist e extração').first().json.texto_daniela,
  data_alerta: ultimo['DATA/HORA']
} }];
""".strip()

SYSTEM_PROMPT = (
    "Você interpreta respostas da compradora de uma construtora sobre alertas de equipamentos locados. "
    "Você receberá: (1) MAPA_ITENS: lista JSON dos itens do último alerta (número do item, id do contrato, descrição); "
    "(2) MENSAGEM: a resposta dela, em texto livre e informal. "
    "Para cada item mencionado, classifique a intenção em uma de: DEVOLVER | RENOVAR | JA_DEVOLVIDO | ADIAR | NAO_ENTENDIDO. "
    "Regras: 'pode devolver', 'não precisa mais', 'libera' => DEVOLVER; 'segura', 'renova', 'mais um mês', 'continua' => RENOVAR; "
    "'já foi', 'já retiraram', 'já devolvi' => JA_DEVOLVIDO; 'depois', 'amanhã', 'vou ver com a obra' => ADIAR. "
    "Se ela citar o número do item, use-o. Se citar só o equipamento, associe pelo texto do MAPA_ITENS. "
    "confianca = 'alta' somente quando item e intenção são inequívocos; havendo qualquer ambiguidade use 'baixa' e intencao NAO_ENTENDIDO. "
    "NUNCA invente itens que não estão no MAPA_ITENS. "
    "Responda SOMENTE com JSON válido, sem texto adicional, no formato: "
    "{\"acoes\":[{\"item\":1,\"id_contrato\":5,\"intencao\":\"DEVOLVER\",\"confianca\":\"alta\",\"justificativa\":\"curta\"}]}"
)

CODE_MONTAR_LLM = r"""
// ===== Monta o corpo da chamada ao LLM =====
const cfg = $('Config').first().json;
const d = $json;
if (d.sem_contexto) return [{ json: { pular_llm: true, texto_daniela: d.texto_daniela } }];

const user = 'MAPA_ITENS:\n' + JSON.stringify(d.mapa_itens, null, 2) + '\n\nMENSAGEM:\n' + d.texto_daniela;
return [{ json: {
  pular_llm: false,
  body: {
    model: cfg.MODEL_LLM,
    max_tokens: 1024,
    temperature: 0,
    system: __SYSTEM_PROMPT__,
    messages: [{ role: 'user', content: user }]
  }
} }];
""".strip().replace("__SYSTEM_PROMPT__", json.dumps(SYSTEM_PROMPT, ensure_ascii=False))

CODE_APLICAR = r"""
// ===== Interpreta o retorno do LLM e prepara atualizações =====
const ctx = $('Recuperar contexto (LOG)').first().json;
const TZ = 'America/Sao_Paulo';
const agora = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const dh = `${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
const cfg = $('Config').first().json;

// Sem contexto de alerta: responde educadamente e encerra
if (ctx.sem_contexto) {
  return [{ json: { tipo: 'resposta_simples', numero: cfg.NUMERO_DANIELA,
    mensagem: 'Não tenho alerta pendente no momento. O próximo resumo de locações sai às 07h00. 🙂' } }];
}

// Parse da resposta do Claude
let acoes = [];
try {
  const raw = $json.content?.[0]?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();
  acoes = (JSON.parse(clean).acoes) || [];
} catch (e) { acoes = []; }

const MAPA_SIT = { 'DEVOLVER': 'DEVOLUÇÃO SOLICITADA', 'RENOVAR': 'RENOVADO', 'JA_DEVOLVIDO': 'DEVOLVIDO' };
const aplicadas = [], pendentes = [];

for (const a of acoes) {
  const item = ctx.mapa_itens.find(m => String(m.id) === String(a.id_contrato) || m.item === a.item);
  if (!item) continue;
  if (a.confianca === 'alta' && MAPA_SIT[a.intencao]) {
    aplicadas.push({ ...a, ...item, nova_situacao: MAPA_SIT[a.intencao] });
  } else if (a.intencao === 'ADIAR' && a.confianca === 'alta') {
    // sem mudança; será re-alertado amanhã
  } else {
    pendentes.push({ ...a, ...item });
  }
}

// Saída 1: linhas p/ atualizar CONTRATOS (appendOrUpdate por ID)
const updates = aplicadas.map(a => ({ json: {
  'ID': Number(a.id),
  'SITUAÇÃO *': a.nova_situacao,
  'ÚLTIMA RESPOSTA (agente)': `Daniela: ${a.intencao} (${dh})`,
  'DATA RESPOSTA (agente)': dh.split(' ')[0]
} }));

// Confirmação no WhatsApp
let msg = '';
if (aplicadas.length) {
  msg += '✅ Anotado:\n' + aplicadas.map(a => {
    const acaoTxt = a.intencao === 'DEVOLVER' ? 'devolver — vou cobrar a retirada' :
                    a.intencao === 'RENOVAR' ? 'renovado por mais um ciclo' :
                    'marcado como devolvido — qual foi a data da retirada?';
    return `${a.item}) ${a.equipamento}: ${acaoTxt}`;
  }).join('\n');
}
if (pendentes.length) {
  msg += (msg ? '\n\n' : '') + '❓ Não tive certeza sobre:\n' + pendentes.map(p =>
    `${p.item ?? '?'}) ${p.equipamento ?? ''} — responda "${p.item} DEVOLVER", "${p.item} RENOVAR" ou "${p.item} JÁ FOI"`).join('\n');
}
if (!msg) msg = '❓ Não consegui entender. Responda com o número do item + DEVOLVER, RENOVAR ou JÁ FOI.\nEx.: "1 devolver"';

// Linhas de LOG
const logs = [{ json: {
  'DATA/HORA': dh, 'ID CONTRATO': '', 'Nº CONTRATO': '',
  'EVENTO': 'RESPOSTA RECEBIDA', 'DETALHE': ctx.texto_daniela, 'CANAL': 'WhatsApp', 'AUTOR': 'Daniela'
} }].concat(aplicadas.map(a => ({ json: {
  'DATA/HORA': dh, 'ID CONTRATO': String(a.id), 'Nº CONTRATO': a.contrato,
  'EVENTO': 'STATUS ALTERADO', 'DETALHE': `→ ${a.nova_situacao} (${a.justificativa || a.intencao})`,
  'CANAL': 'Sistema', 'AUTOR': 'Agente'
} })));

return [{ json: {
  tipo: 'completo', numero: cfg.NUMERO_DANIELA, mensagem: msg,
  updates: updates.map(u => u.json), logs: logs.map(l => l.json)
} }];
""".strip()

CODE_SPLIT_UPDATES = r"""
const d = $json;
if (d.tipo !== 'completo' || !d.updates?.length) return [];
return d.updates.map(u => ({ json: u }));
""".strip()

CODE_SPLIT_LOGS = r"""
const d = $('Aplicar regras').first().json;
if (d.tipo !== 'completo' || !d.logs?.length) return [];
return d.logs.map(l => ({ json: l }));
""".strip()

wf2_nodes = [
    {"id": nid(), "name": "Webhook uazapi", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
     "position": [-680, 0],
     "parameters": {"httpMethod": "POST", "path": "agente-locacoes", "options": {}},
     "webhookId": nid()},
    {"id": nid(), "name": "Config", "type": "n8n-nodes-base.set", "typeVersion": 3.4,
     "position": [-460, 0],
     "parameters": {"assignments": {"assignments": [dict(a, id=nid()) for a in config_assignments]}, "options": {}}},
    {"id": nid(), "name": "Whitelist e extração", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [-240, 0], "parameters": {"jsCode": CODE_WHITELIST}},
    sheets_read("Ler LOG", "LOG", [-20, 0]),
    {"id": nid(), "name": "Recuperar contexto (LOG)", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [200, 0], "parameters": {"jsCode": CODE_CONTEXTO}},
    {"id": nid(), "name": "Montar prompt", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [420, 0], "parameters": {"jsCode": CODE_MONTAR_LLM}},
    {"id": nid(), "name": "Chamar LLM (Claude)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
     "position": [640, 0], "retryOnFail": True, "maxTries": 2, "waitBetweenTries": 3000,
     "parameters": {
         "method": "POST",
         "url": "https://api.anthropic.com/v1/messages",
         "authentication": "genericCredentialType",
         "genericAuthType": "httpHeaderAuth",
         "sendHeaders": True,
         "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}, {"name": "content-type", "value": "application/json"}]},
         "sendBody": True, "specifyBody": "json",
         "jsonBody": "={{ JSON.stringify($json.body) }}",
         "options": {}
     },
     "credentials": {}},
    {"id": nid(), "name": "Aplicar regras", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [860, 0], "parameters": {"jsCode": CODE_APLICAR}},
    {"id": nid(), "name": "Separar updates", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1080, -160], "parameters": {"jsCode": CODE_SPLIT_UPDATES}},
    {"id": nid(), "name": "Atualizar CONTRATOS", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5,
     "position": [1300, -160],
     "parameters": {
         "operation": "appendOrUpdate",
         "documentId": {"__rl": True, "value": "={{ $('Config').first().json.SHEET_ID }}", "mode": "id"},
         "sheetName": {"__rl": True, "value": "CONTRATOS", "mode": "name"},
         "columns": {"mappingMode": "autoMapInputData", "matchingColumns": ["ID"], "schema": []},
         "options": {}
     },
     "credentials": {}},
    {"id": nid(), "name": "Separar logs", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1080, 0], "parameters": {"jsCode": CODE_SPLIT_LOGS}},
    sheets_append("Gravar LOG", "LOG", [1300, 0]),
    {"id": nid(), "name": "Confirmar no WhatsApp (uazapi)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
     "position": [1080, 160], "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000,
     "parameters": {
         "method": "POST",
         "url": "={{ $('Config').first().json.UAZAPI_BASE }}/send/text",
         "authentication": "genericCredentialType",
         "genericAuthType": "httpHeaderAuth",
         "sendBody": True, "specifyBody": "json",
         "jsonBody": "={{ JSON.stringify({ number: $('Aplicar regras').first().json.numero, text: $('Aplicar regras').first().json.mensagem }) }}",
         "options": {}
     },
     "credentials": {}},
]

wf2_connections = {
    "Webhook uazapi": {"main": [[{"node": "Config", "type": "main", "index": 0}]]},
    "Config": {"main": [[{"node": "Whitelist e extração", "type": "main", "index": 0}]]},
    "Whitelist e extração": {"main": [[{"node": "Ler LOG", "type": "main", "index": 0}]]},
    "Ler LOG": {"main": [[{"node": "Recuperar contexto (LOG)", "type": "main", "index": 0}]]},
    "Recuperar contexto (LOG)": {"main": [[{"node": "Montar prompt", "type": "main", "index": 0}]]},
    "Montar prompt": {"main": [[{"node": "Chamar LLM (Claude)", "type": "main", "index": 0}]]},
    "Chamar LLM (Claude)": {"main": [[{"node": "Aplicar regras", "type": "main", "index": 0}]]},
    "Aplicar regras": {"main": [[
        {"node": "Separar updates", "type": "main", "index": 0},
        {"node": "Separar logs", "type": "main", "index": 0},
        {"node": "Confirmar no WhatsApp (uazapi)", "type": "main", "index": 0}
    ]]},
    "Separar updates": {"main": [[{"node": "Atualizar CONTRATOS", "type": "main", "index": 0}]]},
    "Separar logs": {"main": [[{"node": "Gravar LOG", "type": "main", "index": 0}]]},
}

wf2 = {
    "name": "Agente Locações — WF2 Recepção de Respostas (v1.0)",
    "nodes": wf2_nodes,
    "connections": wf2_connections,
    "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo"},
    "pinData": {}
}

with open("WF1 - Alerta Diario v1.0.json", "w", encoding="utf-8") as f:
    json.dump(wf1, f, ensure_ascii=False, indent=2)
with open("WF2 - Recepcao Respostas v1.0.json", "w", encoding="utf-8") as f:
    json.dump(wf2, f, ensure_ascii=False, indent=2)
print("OK - JSONs gerados e válidos")
