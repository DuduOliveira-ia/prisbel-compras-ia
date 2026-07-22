const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

const VERDE = '1E6B52';
const CINZA = 'F2F2F2';
const CINZA_ESC = '595959';

const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, size: 22, ...opts })]
});
const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 },
  children: [new TextRun({ text, size: 22 })]
});
const num = (text) => new Paragraph({
  numbering: { reference: 'steps', level: 0 }, spacing: { after: 100 },
  children: [new TextRun({ text, size: 22 })]
});
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text: t, color: VERDE, bold: true, size: 30 })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, color: '333333', bold: true, size: 25 })] });
const mono = (lines) => lines.map(l => new Paragraph({
  spacing: { after: 20 }, shading: { type: ShadingType.CLEAR, fill: 'F7F7F7' },
  children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas', size: 18 })]
}));
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: VERDE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF' })] })]
  });
}
function cell(text, width, shade) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })]
  });
}
function tbl(headers, rows, widths) {
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, widths[i], ri % 2 ? CINZA : null)) }))
    ]
  });
}

const children = [];

// CAPA
children.push(
  new Paragraph({ spacing: { before: 2000 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ROTEIRO TÉCNICO — n8n', bold: true, size: 48, color: VERDE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Agente de Locações (Demo)', bold: true, size: 34, color: '333333' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: 'Guia de implementação dos workflows — para: Ulisses', size: 24, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Versão 1.0 — Julho de 2026 | Complementa a Especificação Funcional v1.0', size: 20, color: CINZA_ESC })] }),
  new Paragraph({ children: [new PageBreak()] })
);

// 0. VISAO GERAL
children.push(
  h1('1. Visão geral'),
  p('São 2 workflows no n8n. O Workflow 1 roda agendado e envia o alerta diário de locações no WhatsApp. O Workflow 2 é acionado por webhook do uazapi quando a Daniela responde, interpreta a resposta com LLM e atualiza a planilha. A base de dados é uma planilha Google ("Planilha Locações - Modelo Saneado v1.0", abas CONTRATOS e LOG).'),
  ...mono([
    'WF1 (07h00, seg-sex): Sheets CONTRATOS ─▶ filtra pendentes ─▶ monta mensagem ─▶ uazapi /send/text ─▶ grava LOG',
    'WF2 (webhook uazapi): mensagem recebida ─▶ whitelist ─▶ contexto (LOG) ─▶ LLM ─▶ atualiza CONTRATOS ─▶ grava LOG ─▶ confirma no WhatsApp'
  ]),
  h2('Parâmetros globais (variáveis de ambiente / nó Set no início de cada WF)'),
  tbl(
    ['Parâmetro', 'Valor demo', 'Descrição'],
    [
      ['SHEET_ID', '(ID da planilha no Drive)', 'Planilha Locações.'],
      ['INSTANCIA_UAZAPI', 'servidor ssysbot / instância conectada', 'Instância que envia e recebe (nº do agente).'],
      ['TOKEN_UAZAPI', '(credencial no n8n — nunca hardcoded no fluxo)', 'Token da instância.'],
      ['NUMERO_DANIELA', '55319XXXXXXXX', 'Único número autorizado a comandar o agente (whitelist). Na demo pode ser o do Eduardo.'],
      ['DIAS_ANTECEDENCIA', '5', 'Antecedência do alerta de vencimento.'],
      ['EMAIL_FALLBACK', 'compras...@gmail.com', 'Destino do alerta se o WhatsApp falhar.']
    ],
    [2500, 3160, 3700]
  ),
  p('Atenção: os endpoints do uazapi variam por versão (uazapiGO). Os nomes abaixo (/send/text, webhook de mensagens) devem ser conferidos na documentação da instância ssysbot — a lógica não muda.', { italics: true, color: CINZA_ESC, size: 20 })
);

// WF1
children.push(
  h1('2. Workflow 1 — Alerta diário'),
  num('Schedule Trigger: cron 0 7 * * 1-5 (seg a sex, 07h00).'),
  num('Google Sheets (Read): aba CONTRATOS, todas as linhas. Usar valores calculados (a API do Sheets já devolve o resultado das fórmulas PRÓXIMO VENCIMENTO, DIAS P/ VENCER, STATUS ALERTA e CADASTRO).'),
  num('Google Sheets (Read): aba LOG, filtrar EVENTO = "ALERTA ENVIADO" com DATA/HORA = hoje. Guardar a lista de contratos já alertados hoje (idempotência).'),
  num('Code (seleção): montar três listas: (a) ALERTAS = linhas com CADASTRO = "OK" e STATUS ALERTA em [ALERTAR, VENCIDO, DEVOLVER], excluindo contratos já alertados hoje; (b) INCOMPLETOS = linhas cujo CADASTRO começa com "FALTA:"; (c) se ALERTAS e INCOMPLETOS vazios ⇒ encerrar o fluxo (nó IF).'),
  num('Code (mensagem): ordenar ALERTAS por obra e por dias p/ vencer; numerar itens 1..N; montar o texto no formato da Especificação (seção 4): cabeçalho com data, itens com equipamento, fornecedor, nº contrato, data de renovação e valor; itens em DEVOLVER com prefixo ⚠️; ao final, a instrução de resposta ("Para cada item responda: DEVOLVER, RENOVAR ou JÁ FOI"); se houver INCOMPLETOS, acrescentar bloco "⚠️ fora do monitoramento por cadastro incompleto". Gerar também o MAPA_ITENS: JSON [{item:1, id:5, contrato:"218158"}, ...].'),
  num('HTTP Request (uazapi): POST /send/text da instância, com número = NUMERO_DANIELA e o texto montado. Configurar Retry: 2 tentativas, intervalo 30s.'),
  num('IF (falha no envio): se as tentativas falharem ⇒ nó de E-mail (Gmail/SMTP) com o mesmo conteúdo para EMAIL_FALLBACK, e registrar no LOG com CANAL = "E-mail/fallback".'),
  num('Google Sheets (Append) — LOG: uma linha por envio: DATA/HORA atual, IDs dos contratos, EVENTO = "ALERTA ENVIADO", DETALHE = texto da mensagem + MAPA_ITENS (JSON serializado — o WF2 depende disso), CANAL = "WhatsApp", AUTOR = "Agente".'),
  h2('Detalhe importante'),
  p('O MAPA_ITENS gravado no LOG é o "contexto da conversa": é ele que permite ao WF2 saber que "1" significa o contrato 218158. Sem essa gravação, a interpretação da resposta não funciona.')
);

// WF2
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('3. Workflow 2 — Recepção e atualização'),
  num('Webhook Trigger: configurar o Webhook Global do uazapi (evento de mensagem recebida) apontando para a URL deste workflow. Ignorar eventos com fromMe = true.'),
  num('IF (whitelist): se o número do remetente ≠ NUMERO_DANIELA ⇒ encerrar (opcional: registrar no LOG como "MENSAGEM IGNORADA"). Nunca responder a números fora da whitelist.'),
  num('Google Sheets (Read) — LOG: buscar a linha mais recente com EVENTO = "ALERTA ENVIADO" e extrair o MAPA_ITENS do DETALHE. Se não houver alerta nas últimas 48h ⇒ responder "Não tenho alerta pendente. O próximo sai às 07h00." e encerrar.'),
  num('LLM (HTTP Request para API Claude, ou nó AI Agent): enviar o prompt da seção 4 com a mensagem da Daniela + MAPA_ITENS. Saída esperada: JSON com a lista de ações e confiança. Validar que a resposta é JSON válido (nó Code); se inválido, repetir 1 vez; persistindo, tratar como NÃO ENTENDIDO.'),
  num('Code (aplicação das regras): para cada ação com confianca = "alta", mapear a intenção para a nova SITUAÇÃO (DEVOLVER → DEVOLUÇÃO SOLICITADA; RENOVAR → RENOVADO; JA_DEVOLVIDO → DEVOLVIDO; ADIAR → sem mudança). Ações com confiança média/baixa não alteram nada — entram na mensagem de confirmação.'),
  num('Google Sheets (Update) — CONTRATOS: para cada ação aplicada, atualizar SITUAÇÃO, ÚLTIMA RESPOSTA (resumo) e DATA RESPOSTA na linha do ID correspondente.'),
  num('Google Sheets (Append) — LOG: duas linhas por interação: (a) EVENTO = "RESPOSTA RECEBIDA", DETALHE = texto original integral da Daniela; (b) uma linha "STATUS ALTERADO" por contrato alterado, DETALHE = "EM OBRA → DEVOLUÇÃO SOLICITADA". AUTOR = "Daniela" na (a) e "Agente" na (b).'),
  num('HTTP Request (uazapi): enviar confirmação: "✅ Anotado: 1 devolver (cobrar retirada do fornecedor), 2 renovado. ❓ Não entendi o item 3 — responda 3 DEVOLVER, 3 RENOVAR ou 3 JÁ FOI." (montada no nó Code conforme o resultado).'),
  h2('Casos de borda'),
  bullet('Resposta sem número de item e com um único contrato pendente ⇒ o LLM pode inferir com confiança alta. Com mais de um pendente ⇒ obrigatoriamente pedir confirmação.'),
  bullet('JA_DEVOLVIDO ⇒ na confirmação, perguntar a data da retirada e gravar em OBSERVAÇÕES quando ela responder.'),
  bullet('Mensagens de áudio: fora do escopo da demo — responder "Por enquanto só entendo texto 🙂".')
);

// PROMPT
children.push(
  h1('4. Prompt do LLM (pronto para colar no nó)'),
  p('System prompt:'),
  ...mono([
    'Você interpreta respostas da compradora de uma construtora sobre alertas de',
    'equipamentos locados. Você receberá:',
    '(1) MAPA_ITENS: lista JSON dos itens do último alerta, com número do item,',
    '    id do contrato e descrição;',
    '(2) MENSAGEM: a resposta dela, em texto livre e informal.',
    '',
    'Para cada item mencionado, classifique a intenção em uma de:',
    'DEVOLVER | RENOVAR | JA_DEVOLVIDO | ADIAR | NAO_ENTENDIDO',
    '',
    'Regras:',
    '- "pode devolver", "não precisa mais", "libera" => DEVOLVER',
    '- "segura", "renova", "mais um mês", "continua" => RENOVAR',
    '- "já foi", "já retiraram", "já devolvi" => JA_DEVOLVIDO',
    '- "depois", "amanhã", "vou ver com a obra" => ADIAR',
    '- Se ela citar o número do item, use-o. Se citar só o equipamento,',
    '  associe pelo texto do MAPA_ITENS.',
    '- confianca = "alta" somente quando item e intenção são inequívocos.',
    '  Havendo qualquer ambiguidade (mais de um item possível, gíria estranha,',
    '  assunto fora do alerta), use "baixa" e intencao NAO_ENTENDIDO.',
    '- NUNCA invente itens que não estão no MAPA_ITENS.',
    '',
    'Responda SOMENTE com JSON válido, sem texto adicional:',
    '{ "acoes": [ { "item": <n>, "id_contrato": <id>, "intencao": "<...>",',
    '  "confianca": "alta|media|baixa", "justificativa": "<curta>" } ] }'
  ]),
  p(''),
  p('Recomendação: temperatura 0. A "justificativa" é só para depuração no n8n — não vai para a planilha.')
);

// CONFIG UAZAPI + TESTES
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('5. Configuração no uazapi'),
  bullet('Instância dedicada ao agente (já conectada no servidor ssysbot). Não usar número pessoal de ninguém.'),
  bullet('Webhook Global: apontar para a URL do Webhook Trigger do WF2 (n8n). Habilitar apenas evento de mensagens recebidas — filtrar fromMe no fluxo.'),
  bullet('Token: cadastrar como credencial no n8n (não colar dentro de nós HTTP em texto puro; não versionar o token junto com o export do workflow).'),
  bullet('Teste de sanidade antes de montar o fluxo: um POST manual de /send/text para o número de teste, e uma mensagem de volta para confirmar que o webhook dispara no n8n.'),
  h1('6. Checklist de testes (aceite da demo)'),
  tbl(
    ['#', 'Teste', 'Resultado esperado'],
    [
      ['1', 'Rodar WF1 manualmente com a planilha modelo', 'Mensagem chega com itens numerados por obra + bloco de cadastros incompletos (#11 e #12).'],
      ['2', 'Rodar WF1 de novo no mesmo dia', 'Nenhuma mensagem duplicada (idempotência via LOG).'],
      ['3', 'Responder "1 devolve, 2 renova"', 'SITUAÇÃO dos 2 contratos muda; 3 linhas no LOG; confirmação ✅ no WhatsApp.'],
      ['4', 'Responder algo ambíguo ("ok pode ser")', 'Nada muda na planilha; agente pede confirmação com opções numeradas.'],
      ['5', 'Mensagem de outro número', 'Ignorada; sem resposta.'],
      ['6', 'Derrubar credencial do uazapi e rodar WF1', 'Alerta sai por e-mail (fallback) e LOG registra o canal.'],
      ['7', 'Responder "já foi retirado" para item em DEVOLVER', 'SITUAÇÃO → DEVOLVIDO; agente pergunta a data da retirada.']
    ],
    [600, 3800, 4960]
  ),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Dúvidas de regra de negócio (antecedência, texto das mensagens, estados): a referência é a Especificação Funcional v1.0. Este roteiro só traduz aquilo para nós do n8n.', italics: true, size: 20, color: CINZA_ESC })] })
);

const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 300 } } } }] }
    ]
  },
  styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Roteiro Técnico n8n - Agente de Locações v1.0.docx', buf);
  console.log('OK');
});
