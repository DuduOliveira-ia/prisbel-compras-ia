const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

const AZUL = '0019D2';
const CINZA = 'F2F4FA';
const CINZA_ESC = '595959';

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 130 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text, size: 22, ...opts })] });
const pRuns = (runs) => new Paragraph({ spacing: { after: 130 }, alignment: AlignmentType.JUSTIFIED, children: runs.map(r => new TextRun({ size: 22, ...r })) });
const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text, size: 22 })] });
const num = (text) => new Paragraph({ numbering: { reference: 'steps', level: 0 }, spacing: { after: 90 }, children: [new TextRun({ text, size: 22 })] });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: t, color: AZUL, bold: true, size: 30 })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 110 }, children: [new TextRun({ text: t, color: '333333', bold: true, size: 25 })] });
const mono = (lines) => lines.map(l => new Paragraph({ spacing: { after: 20 }, shading: { type: ShadingType.CLEAR, fill: 'F7F7F7' }, children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas', size: 19 })] }));
function hc(text, w) { return new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: AZUL }, margins: { top: 70, bottom: 70, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF' })] })] }); }
function cc(text, w, sh) { return new TableCell({ width: { size: w, type: WidthType.DXA }, shading: sh ? { type: ShadingType.CLEAR, fill: CINZA } : undefined, margins: { top: 70, bottom: 70, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })] }); }
function tbl(headers, rows, widths) {
  return new Table({ columnWidths: widths, width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    rows: [ new TableRow({ tableHeader: true, children: headers.map((h,i)=>hc(h,widths[i])) }),
      ...rows.map((r,ri)=> new TableRow({ children: r.map((t,i)=>cc(t,widths[i],ri%2===1)) })) ] });
}

const children = [];

children.push(
  new Paragraph({ spacing: { before: 1800 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ROTEIRO DE APRESENTAÇÃO', bold: true, size: 48, color: AZUL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Agente de Compras com IA — Demo para a Diretoria', bold: true, size: 32, color: '333333' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'Prisbel / Grupo Muniz Rabelo', size: 24, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: 'v1.0 — 19/07/2026 | Duração alvo: 25 minutos', size: 22, color: CINZA_ESC })] }),
  new Paragraph({ children: [new PageBreak()] })
);

children.push(
  h1('1. Mensagem central'),
  p('Uma frase para reger tudo: "Em uma semana, colocamos agentes de IA trabalhando no processo de compras — sem trocar nenhum sistema, sem mudar o hábito de ninguém: a obra continua mandando e-mail, a Daniela continua no WhatsApp, e a IA faz o trabalho invisível entre eles."'),
  p('Três atos, cada um resolve uma dor levantada no diagnóstico: locações esquecidas (dinheiro parado), requisições incompletas (retrabalho da Daniela) e a fila invisível de pedidos (pedido perdido). Terminar com o roadmap e três pedidos objetivos à diretoria.'),

  h1('2. Links de acesso (deixar abertos em abas, nesta ordem)'),
  tbl(['#','O quê','Link / Acesso'],
  [
    ['1','Painel Compras (Daniela)','https://n8n.ssysbot.com/webhook/painel-compras?t=pb-dnl-4X9k2026'],
    ['2','Planilha (banco de dados)','https://docs.google.com/spreadsheets/d/135kNfQeNbXnc41cU6wiwavAaOqD1h39oVHeDfPNdzVc'],
    ['3','n8n (motor dos agentes)','https://n8n.ssysbot.com/home/workflows — login ssysbot'],
    ['4','Gmail ssysbot (caixa do agente)','https://mail.google.com — conta ssysbot@gmail.com'],
    ['5','Seu Gmail (solicitante/fornecedor)','https://mail.google.com — conta oliveirae.ti@gmail.com'],
    ['6','WhatsApp Web (opcional; melhor usar o celular)','https://web.whatsapp.com — conversa com a Maria (553173452353)'],
  ], [500, 3000, 5800]),
  pRuns([{ text: 'Atenção: ', bold: true }, { text: 'o token na URL do painel é a chave de acesso — não compartilhe a URL no telão sem necessidade (dê zoom no conteúdo, não na barra de endereço).' }]),

  h1('3. Checklist — 30 minutos antes'),
  num('Reiniciar o Chrome e abrir SÓ as 5-6 abas do roteiro (máquina leve = demo fluida; os travamentos que vimos eram excesso de abas).'),
  num('Se aparecer o aviso vermelho "Perigosa" do Chrome no n8n: Detalhes → "acessar este site" (falso positivo já reportado ao Google; some em breve).'),
  num('Conferir no n8n que estão ATIVOS: WF2 Recepção, WF3 Triagem, WF4 Painel, Router. WF1 Alerta fica INATIVO de propósito — será disparado ao vivo.'),
  num('Celular com WhatsApp carregado e conversa da "Maria" aberta; modo Não Perturbe DESLIGADO; espelhar o celular no telão se possível (ou câmera apontada).'),
  num('Na planilha: aba CONTRATOS com os dados da ARBO à vista; aba PEDIDOS com a fila dos testes.'),
  num('Deixar prontos no bloco de notas: o e-mail de teste do Ato 2 (texto na seção 6) e a resposta do Ato 1 ("1 devolver, 2 renova").'),
  num('Tirar PRINTS de segurança de tudo funcionando (painel, alerta WhatsApp, fila, cotações) — é o plano B.'),
  num('Ensaio completo uma vez, cronometrado.')
);

children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('4. Abertura — o case (3 min, sem slides)'),
  p('Contar a história do diagnóstico, com os números do levantamento:'),
  bullet('"Sentamos com a Daniela e mapeamos o dia a dia de compras. Três dores saltaram: primeiro, ~80 contratos de equipamentos locados controlados numa planilha manual — equipamento devolvido que continua sendo cobrado passa batido, e são itens de R$ 150 a R$ 11 mil por mês."'),
  bullet('"Segundo: as requisições chegam incompletas — luva sem tamanho, tomada sem amperagem — e a Daniela gasta o dia ligando para completar informação. E tudo chega marcado como urgente, sem motivo."'),
  bullet('"Terceiro: pedido chega por e-mail, WhatsApp e telefone. São muitos. Passa batido. A própria Daniela nos disse isso."'),
  bullet('"Em vez de comprar um sistema e obrigar todo mundo a mudar, colocamos agentes de IA nos bastidores. Vou mostrar os três funcionando ao vivo, com dados reais."'),

  h1('5. ATO 1 — Locações no WhatsApp (7 min)'),
  p('Dor: dinheiro parado em locação esquecida. Solução: agente que vigia os contratos e conversa com a compradora.'),
  num('Mostrar a aba CONTRATOS na planilha: "estes são os contratos reais da obra ARBO — fornecedor, valor, ciclo de cobrança. Reparem: dois estão com cadastro incompleto de propósito."'),
  num('No n8n, abrir o WF1 e clicar "Execute workflow": "o agente acabou de varrer os contratos".'),
  num('Levantar o celular: o alerta chegou no WhatsApp — itens numerados, valores, e o aviso dos 2 contratos fora do monitoramento por cadastro incompleto. "Ele não esconde problema: expõe."'),
  num('Responder no celular, em linguagem natural: "1 devolver, 2 renova". Falar enquanto isso: "sem app novo, sem senha, sem treinamento — é o WhatsApp dela".'),
  num('Voltar à planilha: SITUAÇÃO mudou sozinha; abrir a aba LOG: "cada decisão vira registro com data e hora — se o fornecedor faturar depois da devolução, temos a prova para contestar a cobrança".'),
  pRuns([{ text: 'Frase de fecho do ato: ', bold: true }, { text: '"Um ciclo de locação evitado paga meses desta solução."' }])
);

children.push(
  h1('6. ATO 2 — Triagem de pedidos no e-mail (7 min)'),
  p('Dor: requisição incompleta + fila invisível. Solução: agente que lê o e-mail, valida contra os requisitos da qualidade (Tabela R.09) e organiza a fila.'),
  num('Do seu Gmail pessoal, enviar ao vivo para ssysbot@gmail.com o e-mail abaixo (copiar/colar do bloco de notas):'),
  ...mono([
    'Assunto: Pedido de materiais obra ARBO — apresentação',
    '',
    'Bom dia! Preciso urgente dos itens abaixo:',
    '- 8 pares de botina de couro bico plástico CA 48026 tamanho 40',
    '- 50 luvas de vaqueta',
    '- 10 tomadas de sobrepor com espelho',
    '- 5 sacos de cimento'
  ]),
  num('Enquanto o agente processa (±1 min), explicar: "ele vai classificar cada item por categoria, conferir contra os requisitos mínimos da Tabela R.09 da qualidade — que hoje existe mas ninguém consulta na entrada — e montar a fila".'),
  num('Mostrar o aviso que chegou no seu e-mail: 1 item completo, 3 pendentes, urgência sem motivo apontada. "As luvas sem tamanho e CA: exatamente a ligação que a Daniela faria, feita pelo agente em 1 minuto."'),
  num('Mostrar na caixa do ssysbot os RASCUNHOS prontos: devolução ao solicitante pedindo o que falta, e cotação do item completo já endereçada ao fornecedor da categoria.'),
  num('Se der tempo (opcional forte): mostrar o caso do PDF — a requisição 511 real da obra, encaminhada com corpo vazio, e o agente lendo o PDF anexo. "O pedido chega como a obra manda — foto, PDF, texto corrido."'),
  pRuns([{ text: 'Frase de fecho do ato: ', bold: true }, { text: '"Nenhum pedido se perde mais, e a régua da qualidade passou a valer na entrada do processo."' }])
);

children.push(
  h1('7. ATO 3 — Painel da compradora (5 min)'),
  num('Abrir o Painel (link 1) no telão: identidade Prisbel, pedidos numerados (7.1, 7.2...), status coloridos, selos de material CONTROLADO.'),
  num('Mostrar a aba Requisitos: "as regras são da Daniela — ela edita aqui, sem programador. Adicionamos a categoria AÇO em 30 segundos, ao vivo, na semana passada."'),
  num('Clicar "Enviar p/ cotação" num pedido com itens completos: o modal separa por categoria, com fornecedores pré-selecionados. "Bloco não vai no e-mail do material de limpeza — cada fornecedor recebe só o que é dele."'),
  num('Enviar e mostrar a confirmação + status EM COTAÇÃO mudando na fila.'),
  pRuns([{ text: 'Frase de fecho do ato: ', bold: true }, { text: '"Da chegada do e-mail à cotação no fornecedor: minutos, com a Daniela no comando de cada clique que importa."' }])
);

children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('8. Fechamento e pedidos (3 min)'),
  bullet('O que existe hoje: 3 agentes + 1 painel, rodando na infraestrutura própria (VPS já contratado), custo de IA na casa de centavos por pedido, dados na planilha da empresa.'),
  bullet('Próximo capítulo (já estruturado): fornecedores respondem as cotações → a IA lê as respostas e monta o comparativo por item com o melhor preço — o Mapa de Coleta da Daniela, automático. Depois: alertas aos almoxarifes, WhatsApp das obras, integração Totvs.'),
  p('Os três pedidos à diretoria:'),
  num('Patrocínio para o piloto com a Daniela usando pedidos reais por 30 dias (ela já está engajada).'),
  num('Um chip dedicado para o número oficial "Compras Prisbel" no WhatsApp (custo de um pré-pago).'),
  num('Meia hora do Luiz por semana para destravar decisões do piloto.'),

  h1('9. Plano B — se algo falhar ao vivo'),
  tbl(['Se falhar...','Faça...'],
  [
    ['Internet / n8n fora do ar','Seguir o roteiro pelos PRINTS de segurança (checklist item 7). A narrativa não muda: "isto aqui rodou ontem, ao vivo, nestas telas".'],
    ['Alerta WhatsApp demorar','Não esperar parado: ir ao Ato 2 e voltar quando chegar. ("O poller roda a cada minuto.")'],
    ['E-mail do Ato 2 não triar em 2 min','Mostrar a fila já existente no painel (Pedidos 5-7, dados reais de teste) e o aviso de um teste anterior no e-mail.'],
    ['Aviso "site perigoso" do Chrome no telão','Detalhes → acessar site. Uma linha de contexto: "classificação automática de domínio novo, revisão já solicitada ao Google" — e seguir.'],
    ['Pergunta técnica que travar','"Ótima pergunta — anoto e te trago a resposta amanhã com precisão." Anotar de verdade.'],
  ], [3200, 6100]),

  h1('10. Perguntas prováveis — respostas prontas'),
  tbl(['Pergunta','Resposta'],
  [
    ['Quanto custa isso?','Infra: VPS que já pagamos + uazapi já contratado. IA: centavos por pedido (Gemini). O maior custo foi tempo de construção — uma semana.'],
    ['E se a IA errar?','Ela não compra nada e não fecha nada: prepara, valida e organiza. Toda decisão é da Daniela. E quando ela não entende, ela avisa em vez de esconder — mostramos isso ao vivo.'],
    ['Nossos dados estão seguros?','Dados na planilha Google da empresa, acesso por OAuth e token; nada em servidor de terceiros além dos que já usamos. Migração para banco dedicado está no roadmap.'],
    ['A obra vai ter que mudar alguma coisa?','Nada. A obra manda e-mail como sempre mandou — texto, PDF ou foto. Essa foi a premissa nº 1 do desenho.'],
    ['Quando integra com o Totvs?','Fase 3 do blueprint, depois do piloto validar o processo. Integrar antes de calibrar seria automatizar o erro.'],
    ['E o WhatsApp da Daniela, é o pessoal dela?','No piloto usamos número de teste. O pedido nº 2 à diretoria é exatamente o chip dedicado oficial.'],
  ], [3000, 6300]),

  new Paragraph({ spacing: { before: 250 }, children: [new TextRun({ text: 'Regra de ouro da demo: nunca explicar o que dá para MOSTRAR. Cada minuto de tela vale dez de slide. E terminar no horário — diretoria lembra de quem termina no horário.', italics: true, size: 21, color: CINZA_ESC })] })
);

const doc = new Document({
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
    { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 300 } } } }] }
  ] },
  styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Roteiro Apresentação Demo v1.0.docx', buf);
  console.log('OK');
});
