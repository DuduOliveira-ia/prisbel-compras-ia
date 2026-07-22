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
const pRuns = (runs) => new Paragraph({
  spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED,
  children: runs.map(r => new TextRun({ size: 22, ...r }))
});
const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 },
  children: [new TextRun({ text, size: 22 })]
});
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text: t, color: VERDE, bold: true, size: 30 })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, color: '333333', bold: true, size: 25 })] });

const mono = (lines) => lines.map(l => new Paragraph({
  spacing: { after: 20 }, shading: { type: ShadingType.CLEAR, fill: 'F7F7F7' },
  children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas', size: 19 })]
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
  new Paragraph({ spacing: { before: 2200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ESPECIFICAÇÃO FUNCIONAL', bold: true, size: 48, color: VERDE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Agente de Locações — Demo', bold: true, size: 34, color: '333333' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: 'Alertas de vencimento e devolução de equipamentos locados via WhatsApp', size: 24, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Grupo Muniz Rabelo (Prisbel / Prisma) — Depto. de Compras', size: 22, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Versão 1.0 — Julho de 2026 | Documento complementar ao Blueprint v1.0', size: 20, color: CINZA_ESC })] }),
  new Paragraph({ children: [new PageBreak()] })
);

// 1. OBJETIVO
children.push(
  h1('1. Objetivo e escopo'),
  p('Especificar a demonstração funcional (demo) do Agente de Locações: um agente que lê a planilha de equipamentos locados no Google Drive, dispara alertas de vencimento e devolução para a Daniela via WhatsApp, interpreta a resposta dela e atualiza o status na planilha — fechando o ciclo na frente da diretoria.'),
  p('A demo é o Módulo A do Blueprint em versão mínima. Objetivo de negócio: demonstrar valor em reais (ciclos de locação evitados) e conquistar patrocínio para o MVP completo.'),
  h2('Fora de escopo desta demo (vai para o SDD)'),
  bullet('Leitura automática de contratos/NFs de locação para preencher a planilha (entrada de dados continua manual na demo).'),
  bullet('Alertas para os almoxarifes das obras (demo alerta somente a Daniela).'),
  bullet('Módulo B (triagem de requisições), painel gerencial e integração Totvs.')
);

// 2. ARQUITETURA
children.push(
  h1('2. Arquitetura da demo'),
  tbl(
    ['Componente', 'Papel', 'Observação'],
    [
      ['Google Sheets (planilha "Locações")', 'Base de dados: abas CONTRATOS, LISTAS, LOG e LEIA-ME (modelo v1.0 entregue junto).', 'Simples de auditar e de mostrar ao vivo; migração p/ Supabase prevista no MVP.'],
      ['n8n', 'Orquestração: agendamento diário, leitura/escrita na planilha, envio e recepção de mensagens, chamada ao LLM.', 'Reaproveitar a infraestrutura existente do Ulisses.'],
      ['UZAPI (WhatsApp)', 'Canal de envio dos alertas e recepção das respostas da Daniela.', 'Número dedicado ao agente. Suficiente p/ demo; API oficial Meta prevista p/ produção.'],
      ['LLM (API Claude)', 'Interpretar a resposta em texto livre da Daniela e classificar a intenção.', 'Só interpreta; nunca decide sozinho. Cálculo de vencimento é regra determinística no n8n.'],
      ['Caixa de e-mail (fallback)', 'Se o envio WhatsApp falhar, o alerta sai por e-mail para compras@.', 'Regra de robustez: alerta de dinheiro não pode morrer em silêncio.']
    ],
    [2400, 4260, 2700]
  )
);

// 3. PLANILHA
children.push(
  h1('3. A planilha (dicionário de dados)'),
  p('A aba CONTRATOS é a fonte única de verdade. Colunas amarelas são preenchidas por humanos; colunas cinza são calculadas ou preenchidas pelo agente.'),
  tbl(
    ['Coluna', 'Obrigatória', 'Preenchida por', 'Regra'],
    [
      ['ID', 'Sim', 'Planilha', 'Sequencial único. Referência usada nos alertas e no LOG.'],
      ['OBRA', 'Sim', 'Daniela', 'Lista suspensa (aba LISTAS).'],
      ['EQUIPAMENTO / MATERIAL', 'Sim', 'Daniela', 'Texto livre, como consta no contrato.'],
      ['QUANT.', 'Sim', 'Daniela', 'Numérico.'],
      ['FORNECEDOR', 'Sim', 'Daniela', 'Lista suspensa.'],
      ['Nº CONTRATO', 'Sim', 'Daniela', 'Chave de conversa com o fornecedor.'],
      ['VALOR DO CICLO (R$)', 'Sim', 'Daniela', 'Valor cobrado por ciclo (não o total).'],
      ['DATA INÍCIO', 'Sim', 'Daniela', 'Data-base da cobrança (1º dia do contrato).'],
      ['CICLO', 'Sim', 'Daniela', 'MENSAL, QUINZENAL, SEMANAL, DIÁRIA ou DATA ESPECÍFICA.'],
      ['DATA FIM', 'Condicional', 'Daniela', 'Obrigatória quando CICLO = DATA ESPECÍFICA.'],
      ['RESPONSÁVEL / TELEFONE', 'Não (demo)', 'Daniela', 'Almoxarife da obra — usado na fase 2 (alertas à obra).'],
      ['SITUAÇÃO', 'Sim', 'Daniela ou Agente', 'EM OBRA, DEVOLUÇÃO SOLICITADA, DEVOLVIDO, RENOVADO.'],
      ['PRÓXIMO VENCIMENTO / DIAS / STATUS ALERTA', '—', 'Fórmula', 'Calculados a partir de DATA INÍCIO + CICLO.'],
      ['CADASTRO', '—', 'Fórmula', '"OK" ou "FALTA: <campos>". Contrato incompleto não é monitorado.'],
      ['ÚLTIMA RESPOSTA / DATA RESPOSTA', '—', 'Agente', 'Registro resumido da última interação.'],
      ['OBSERVAÇÕES', 'Não', 'Livre', '—'],
    ],
    [2600, 1300, 1500, 3960]
  ),
  p('A aba LOG é escrita exclusivamente pelo agente: cada alerta enviado, resposta recebida e mudança de status vira uma linha com data/hora, contrato, evento, detalhe, canal e autor. É o histórico de auditoria — nada é sobrescrito, tudo é acrescentado.', { })
);

// 4. FLUXO 1
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('4. Fluxo 1 — Alerta diário'),
  h2('Gatilho e seleção'),
  bullet('Agendamento n8n: todo dia útil às 07h00.'),
  bullet('Seleciona contratos com CADASTRO = OK e STATUS ALERTA em {ALERTAR, VENCIDO, DEVOLVER}.'),
  bullet('Antecedência padrão: 5 dias antes do vencimento do ciclo (parâmetro configurável).'),
  bullet('Regra de fim de semana: vencimento no sábado, domingo ou segunda gera alerta já na quinta-feira.'),
  bullet('Idempotência: antes de enviar, consulta o LOG — contrato já alertado no dia não é alertado de novo. Contrato sem resposta volta no alerta do dia seguinte, marcado como reenvio.'),
  h2('Formato da mensagem (agrupada por obra, itens numerados)'),
  ...mono([
    '🔔 LOCAÇÕES — ARBO — 15/07',
    '',
    '1) TORRE COMPLETA — LOCSOLO (contr. 218158)',
    '   Renova em 26/07 — R$ 1.298,50/mês',
    '2) 250 ESCORAS 3,10M — PAMPULHA (contr. 6769)',
    '   Renova em 23/07 — R$ 2.922,00/mês',
    '3) ⚠️ 150 FORCADO SIMPLES — LOCSOLO (contr. 220366)',
    '   Devolução solicitada em 10/07 — retirada ainda não confirmada',
    '',
    'Para cada item, responda: DEVOLVER, RENOVAR ou JÁ FOI',
    'Ex.: "1 devolver, 2 renova, 3 já foi retirado"'
  ]),
  p(''),
  p('Os itens numerados são a chave da robustez: a Daniela pode responder em texto livre, mas o número âncora elimina ambiguidade sobre a qual contrato ela se refere.'),
  h2('Registro'),
  bullet('Cada envio gera linha no LOG (EVENTO = ALERTA ENVIADO) com a lista de contratos incluídos.'),
  bullet('Falha no envio WhatsApp após 2 tentativas → dispara o mesmo conteúdo por e-mail e registra no LOG (CANAL = E-mail/fallback).')
);

// 5. FLUXO 2
children.push(
  h1('5. Fluxo 2 — Resposta da Daniela e mudança de status'),
  h2('Recepção e interpretação'),
  p('Toda mensagem recebida do número da Daniela é enviada ao LLM junto com o contexto do último alerta (lista numerada de contratos pendentes). O LLM devolve JSON estruturado:'),
  ...mono([
    '{ "acoes": [',
    '  { "item": 1, "id_contrato": 5, "intencao": "DEVOLVER",  "confianca": "alta" },',
    '  { "item": 2, "id_contrato": 7, "intencao": "RENOVAR",   "confianca": "alta" },',
    '  { "item": 3, "id_contrato": 6, "intencao": "JA_DEVOLVIDO", "confianca": "media" }',
    '] }'
  ]),
  p(''),
  h2('Intenções reconhecidas e efeito na planilha'),
  tbl(
    ['Intenção', 'Exemplos de resposta', 'SITUAÇÃO passa a', 'Ação complementar'],
    [
      ['DEVOLVER', '"pode devolver", "1 devolve", "não precisa mais"', 'DEVOLUÇÃO SOLICITADA', 'Agente confirma e lembra: "avise o fornecedor p/ retirada; vou cobrar a confirmação em 2 dias".'],
      ['RENOVAR', '"segura mais um mês", "2 renova"', 'RENOVADO → EM OBRA', 'Próximo vencimento avança um ciclo (fórmula já cobre); LOG registra a decisão.'],
      ['JÁ DEVOLVIDO', '"esse já foi retirado semana passada"', 'DEVOLVIDO', 'Agente pergunta a data da retirada (para conferência contra a próxima NF do fornecedor).'],
      ['ADIAR', '"me lembra amanhã", "vou ver com a obra"', '(inalterada)', 'Re-alerta no dia seguinte às 07h00.'],
      ['NÃO ENTENDIDO', 'resposta ambígua ou fora de contexto', '(inalterada)', 'Agente responde com opções numeradas explícitas; nunca altera status com confiança baixa.']
    ],
    [1600, 2600, 2100, 3060]
  ),
  h2('Regras de segurança'),
  bullet('O agente só altera SITUAÇÃO com confiança alta; confiança média/baixa gera pergunta de confirmação ("Entendi que o item 3 já foi retirado — confirma?").'),
  bullet('Toda alteração gera duas linhas no LOG: RESPOSTA RECEBIDA (texto original da Daniela) e STATUS ALTERADO (de → para). O texto original nunca se perde.'),
  bullet('Somente o número da Daniela é aceito na demo (whitelist). Mensagens de outros números são ignoradas e logadas.'),
  bullet('Após atualizar, o agente confirma por mensagem: "✅ Anotado: 1 devolver (LOCSOLO será cobrado p/ retirada), 2 renovado até 23/08, 3 marcado como devolvido."')
);

// 6. MAQUINA DE ESTADOS
children.push(
  h1('6. Máquina de estados da SITUAÇÃO'),
  ...mono([
    'EM OBRA ──(Daniela: devolver)──▶ DEVOLUÇÃO SOLICITADA ──(retirada confirmada)──▶ DEVOLVIDO',
    '   │                                      │',
    '   │                                      └─(2 dias sem confirmação)──▶ re-alerta "DEVOLVER"',
    '   └──(Daniela: renovar)──▶ RENOVADO (volta a EM OBRA com novo ciclo)',
    '',
    'DEVOLVIDO = estado final: sai do monitoramento.',
    'Se chegar NF do fornecedor após DEVOLVIDO ⇒ cobrança indevida (checagem manual na demo).'
  ]),
  p(''),
  p('Essa última linha é o argumento de venda mais forte: o LOG prova a data em que a devolução foi decidida. Se o fornecedor faturar um ciclo depois disso, há evidência documentada para contestar a cobrança.')
);

// 7. VALIDACAO CADASTRO
children.push(
  h1('7. Fluxo 3 — Validação de cadastro'),
  bullet('Diariamente, junto ao alerta das 07h00, o agente verifica a coluna CADASTRO. Contratos com "FALTA: ..." entram numa seção separada da mensagem: "⚠️ 2 contratos fora do monitoramento por cadastro incompleto: #11 falta DATA INÍCIO; #12 falta CICLO".'),
  bullet('Racional: um contrato incompleto que não gera alerta é risco silencioso — pior que não ter agente. A pendência fica visível até ser resolvida.'),
  bullet('No SDD, este fluxo evolui: o agente lerá o contrato/NF anexado por e-mail, preencherá a linha e apontará ele mesmo os campos que não conseguiu extrair.')
);

// 8. CRITERIOS + ROTEIRO
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('8. Critérios de aceite da demo'),
  tbl(
    ['#', 'Critério'],
    [
      ['1', 'Alerta diário chega ao WhatsApp da Daniela às 07h00 com todos os contratos em ALERTAR/VENCIDO/DEVOLVER, agrupados por obra e numerados.'],
      ['2', 'Resposta em texto livre ("1 devolve, 2 renova") atualiza a SITUAÇÃO correta na planilha em menos de 1 minuto, com confirmação por mensagem.'],
      ['3', 'Nenhuma alteração de status sem registro duplo no LOG (resposta original + mudança de → para).'],
      ['4', 'Contrato com cadastro incompleto aparece como pendência e não gera alerta de vencimento.'],
      ['5', 'Mesmo contrato não é alertado duas vezes no mesmo dia (idempotência via LOG).'],
      ['6', 'Falha simulada do WhatsApp aciona o fallback por e-mail.']
    ],
    [700, 8660]
  ),
  h2('Roteiro sugerido de demonstração (10 min)'),
  bullet('1. Mostrar a planilha: contratos reais da ARBO, um vencendo em 2 dias, um com devolução pendente, dois com cadastro incompleto.'),
  bullet('2. Disparar o alerta manualmente (trigger do n8n) — a mensagem chega no telefone na frente de todos.'),
  bullet('3. Daniela responde em linguagem natural, do jeito dela.'),
  bullet('4. Projetar a planilha: SITUAÇÃO mudando e LOG registrando ao vivo.'),
  bullet('5. Fechar com a conta: valor/mês dos contratos monitorados × ciclos evitados = economia estimada. Comparar com o custo da solução.')
);

// 9. PROXIMOS PASSOS
children.push(
  h1('9. Próximos passos'),
  bullet('1. Sessão de saneamento com a Daniela (1–2h): completar datas e ciclos dos contratos da ARBO no modelo v1.0.'),
  bullet('2. Subir a planilha no Google Drive e conectar o n8n (com Ulisses).'),
  bullet('3. Construir os fluxos 1 e 2; testar com números internos.'),
  bullet('4. Ensaiar o roteiro da demo com a Daniela antes da apresentação à diretoria.'),
  bullet('5. Após aprovação: iniciar o SDD (leitura de contrato/NF para preenchimento automático, alertas ao almoxarife, migração Supabase, API oficial WhatsApp).'),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Controle de versão: este documento segue versionamento por arquivo (v1.0, v1.1, ...). Alterações geram novo arquivo, preservando o histórico.', italics: true, size: 20, color: CINZA_ESC })] })
);

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }]
    }]
  },
  styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Especificação Funcional - Agente de Locações Demo v1.0.docx', buf);
  console.log('OK');
});
