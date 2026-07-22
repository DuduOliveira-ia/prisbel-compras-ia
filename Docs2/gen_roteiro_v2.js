const docx = require('docx');
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak
} = docx;

const AZUL = '0019D2', AZUL2 = '1E63F0', CINZA = '7a84a5';

const numbering = {
  config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] },
    { reference: 'chk', levels: [{ level: 0, format: LevelFormat.BULLET, text: '☐', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }
  ]
};

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, children: [new TextRun({ text: t, color: AZUL, bold: true })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text: t, color: AZUL2, bold: true })] }); }
function p(t, o) { o = o || {}; return new Paragraph({ spacing: { after: 100 }, children: [new TextRun(Object.assign({ text: t, size: 21 }, o))] }); }
function pr(runs) { return new Paragraph({ spacing: { after: 100 }, children: runs.map(r => new TextRun(Object.assign({ size: 21 }, r))) }); }
function bul(t, o) { return new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: [new TextRun(Object.assign({ text: t, size: 21 }, o || {}))] }); }
function chk(t) { return new Paragraph({ numbering: { reference: 'chk', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 21 })] }); }
function mono(lines) {
  return lines.map(l => new Paragraph({
    spacing: { after: 20 }, shading: { type: ShadingType.CLEAR, fill: 'F3F5FB' },
    children: [new TextRun({ text: l === '' ? ' ' : l, font: 'Consolas', size: 19 })]
  }));
}
function falar(t) {
  return new Paragraph({
    spacing: { after: 100 }, indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: AZUL2 } },
    children: [new TextRun({ text: '🗣 ' + t, italics: true, size: 21, color: '33406b' })]
  });
}

function tabela(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'E9EEFB' }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: AZUL })] })] })) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: c, size: 20 })] })] })) }))
    ]
  });
}

const kids = [];

// CAPA / TÍTULO
kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Roteiro de Apresentação — Demo Bella v2.0', bold: true, size: 34, color: AZUL })] }));
kids.push(p('Processo de Compras com IA — Prisbel Construtora / Grupo Muniz Rabelo', { color: CINZA }));
kids.push(p('Data: 22/07/2026  ·  Duração alvo: 25–30 min  ·  Apresentador: Eduardo', { color: CINZA }));
kids.push(p('Versão 2.0 — substitui o Roteiro v1.0. Novidades: Bella no WhatsApp com memória, revalidação de status no painel, cotação com e-mail individual por fornecedor.', { color: CINZA, size: 19 }));

// LINKS
kids.push(h1('1. Links de acesso (deixar abertos em abas antes de começar)'));
kids.push(tabela(['O quê', 'Link / Acesso'], [
  ['Painel da Daniela (v1.2)', 'https://n8n.ssysbot.com/webhook/painel-compras?t=pb-dnl-4X9k2026'],
  ['Planilha (banco de dados)', 'https://docs.google.com/spreadsheets/d/1F_fyUNPqYoJQoXnl_H98qb64udP9otXescZkucJWYU8/edit'],
  ['Gmail da Bella (caixa ssysbot)', 'https://mail.google.com — conta ssysbot@gmail.com'],
  ['Gmail "Daniela" (avisos/rascunhos)', 'conta oliveirae.ti@gmail.com'],
  ['WhatsApp da Bella', '+55 31 97345-2353 (instância Maria / uazapi)'],
  ['n8n (bastidores, se pedirem)', 'https://n8n.ssysbot.com — workflows WF3, WF4, WF6, Router'],
], [3200, 6700]));
kids.push(p('Se o Chrome mostrar aviso vermelho "site perigoso" (falso positivo já reportado ao Google): Detalhes → "acessar este site". Fazer isso ANTES da reunião em cada aba.', { size: 19, color: 'B02A2A' }));

// CHECKLIST
kids.push(h1('2. Checklist — 1 hora antes'));
kids.push(chk('Planilha zerada (PEDIDOS / MEMORIA / COTACOES sem linhas de dados; REQUISITOS, FORNECEDORES e CONTRATOS intactos)'));
kids.push(chk('Painel abre e mostra "Nenhum pedido na fila" (F5 para garantir versão nova)'));
kids.push(chk('Interstício do Safe Browsing liberado em todas as abas'));
kids.push(chk('WhatsApp Web logado com SEU número (para conversar com a Bella ao vivo)'));
kids.push(chk('Gmail ssysbot e oliveirae.ti logados em janelas separadas (ou perfis do Chrome)'));
kids.push(chk('Esta massa de teste aberta para copiar/colar (seção 4)'));
kids.push(chk('Teste rápido de fumaça: mandar "oi" no WhatsApp da Bella — ela deve se apresentar'));

// NARRATIVA
kids.push(h1('3. Narrativa de abertura (2 min)'));
kids.push(falar('Hoje o pedido de material chega por WhatsApp, por e-mail, por telefone. A Daniela recebe, interpreta, caça informação que falta, monta cotação, cobra fornecedor. O conhecimento está na cabeça dela — nas palavras dela: "acabo conseguindo comprar porque tenho informações de compras anteriores e pela experiência… se fosse outra pessoa, teria que perguntar ao requisitante".'));
kids.push(falar('O que vou mostrar é a Bella: uma assistente de IA que recebe pedidos por e-mail e WhatsApp, confere requisitos, cobra o que falta, organiza a fila e prepara as cotações — deixando a Daniela com a decisão, não com a digitação.'));
kids.push(p('Regra de ouro da demo: a planilha começa VAZIA. Tudo que aparecer na tela nasceu na frente deles — essa é a mágica.', { bold: true }));

// MASSA DE TESTE
kids.push(h1('4. Demo passo a passo, com a massa de teste'));

kids.push(h2('ATO 1 — E-mail vira fila de compras (7 min)'));
kids.push(p('Passo 1.1 — Enviar de qualquer conta para ssysbot@gmail.com (assunto precisa conter "Prisbel"):', { bold: true }));
kids.push(...mono([
  'Assunto: Prisbel - Pedido Material Alvenaria',
  '',
  'Preciso cotar os seguintes materiais:',
  '- 500 tijolos ceramicos de vedacao 9x19x19',
  '- 10 sacos de cimento CP II-32 50kg',
  '- 20 kg de arame recozido n. 18',
  '- 15 kg de vergalhao CA-50 3/8',
  'Para a obra da Rua das Flores, bloco A. Entrega ate dia 15.',
]));
kids.push(pr([{ text: 'Esperado (até ~90s): ', bold: true }, { text: 'Pedido 1 na planilha e no painel com 4 itens COMPLETOS (1.1 a 1.4), e aviso "[Bella] Pedido 1 triado — 4 ok / 0 pendente(s)" no e-mail da Daniela (oliveirae.ti).' }]));
kids.push(falar('Ninguém digitou nada. A Bella leu, entendeu, sequenciou os itens e classificou por categoria — inclusive marcando materiais controlados da Tabela R.09.'));

kids.push(p('Passo 1.2 — Pedido com pendência (mostra a cobrança automática):', { bold: true }));
kids.push(...mono([
  'Assunto: Prisbel - Hidraulica Bloco B',
  '',
  'Preciso:',
  '- 30 metros de tubo PVC esgoto 100mm',
  '- 20 conexoes joelho 90 graus 100mm',
  '- Cola PVC',
  '- 5 rolos de veda rosca',
  'Entrega urgente, obra parada.',
]));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: 'Pedido 2 com itens PENDENTES (cola PVC sem quantidade; tubo/joelho pedem tipo soldável/roscável) e urgência aceita com motivo "obra parada". A Bella deixa RASCUNHO de e-mail pronto para devolver ao solicitante.' }]));
kids.push(falar('A Bella não trava o processo: registra o que dá, aponta exatamente o que falta e já prepara a cobrança. Detalhe: "obra parada" foi aceito como motivo de urgência — ela entende contexto, não só palavras-chave.'));

kids.push(h2('ATO 2 — Painel da Daniela (8 min)'));
kids.push(p('Passo 2.1 — Abrir o painel e navegar: pedidos agrupados, sequencial item a item, badges CONTROLADO, abas Requisitos e Fornecedores editáveis.', { bold: true }));
kids.push(p('Passo 2.2 — Revalidação por IA (o momento "uau"): no Pedido 2, clicar ✎ no tubo PVC, escrever na coluna Pendências apenas:', { bold: true }));
kids.push(...mono(['Soldavel']));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: 'ao salvar, a Bella incorpora "soldável" à descrição do item, limpa a pendência e muda o status para COMPLETO sozinha.' }]));
kids.push(falar('A Daniela não precisa reescrever o item — responde a pendência e a Bella revalida e atualiza o cadastro.'));
kids.push(p('Passo 2.3 — Cotação: no Pedido 1, clicar "Enviar p/ cotação". Mostrar: um bloco por categoria, fornecedores DA categoria pré-marcados, contador "Enviar N e-mail(s)" reagindo aos checks, placeholder {FORNECEDOR} na mensagem.', { bold: true }));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: 'um e-mail INDIVIDUAL por fornecedor, com "Prezados, bom dia! <Nome do Fornecedor>" personalizado, e os itens mudando para EM COTAÇÃO. Mostrar os e-mails chegando na caixa oliveirae.ti (fornecedores de teste).' }]));

kids.push(h2('ATO 3 — Bella no WhatsApp, com memória (8 min)'));
kids.push(p('Conversar do SEU celular com +55 31 97345-2353. Mensagens na ordem:', { bold: true }));
kids.push(p('Passo 3.1 — Pedido simples:', { bold: true }));
kids.push(...mono(['Bella, preciso cotar 200 blocos de concreto 14x19x39 e 5 sacos de', 'argamassa colante AC2. Entrega no canteiro Rua das Flores ate amanha.']));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: '"Pedido 3 registrado!" com itens numerados; se algo ficar pendente, ela pede: "Me manda o que falta que eu completo o pedido".' }]));
kids.push(p('Passo 3.2 — Complemento SEM citar o pedido (o teste de fogo da memória):', { bold: true }));
kids.push(...mono(['sao blocos estruturais com furos, resistencia 4,5 MPa']));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: '"Pedido 3 atualizado!" — ela entende pelo contexto da conversa QUAL item completar, atualiza a linha existente (não cria pedido novo) e anexa a especificação à descrição.' }]));
kids.push(falar('Isso é memória de conversa: como falar com uma pessoa. E se o pedido ficar completo, a Daniela recebe e-mail avisando que está pronto para cotação.'));
kids.push(p('Passo 3.3 — Status:', { bold: true }));
kids.push(...mono(['Como estao meus pedidos?']));
kids.push(pr([{ text: 'Esperado: ', bold: true }, { text: 'resumo dos últimos pedidos, item a item, com o que ainda falta — inclusive os que entraram por E-MAIL. Um canal enxerga o outro.' }]));

kids.push(h2('EXTRA (se sobrar tempo) — Alertas de Locações (3 min)'));
kids.push(p('No n8n, abrir WF1 "Alerta Diário" e clicar Execute Workflow: chega WhatsApp com vencimentos de locação e pendências de cadastro; responder "1 devolve, 2 renova" muda a SITUAÇÃO na planilha com confirmação.'));

// FECHAMENTO
kids.push(h1('5. Fechamento e roadmap (3 min)'));
kids.push(bul('Hoje: e-mail + WhatsApp + painel + cotação personalizada, tudo alimentando uma fila única com auditoria.'));
kids.push(bul('Próximo módulo (WF5): a Bella lê as RESPOSTAS dos fornecedores, monta o comparativo por item e aponta a melhor cotação — sem burocratizar o fornecedor.'));
kids.push(bul('Memória também no e-mail (hoje exclusiva do WhatsApp), número dedicado "Bella" para produção, e conta corporativa própria.'));
kids.push(falar('O que vocês viram não é protótipo de slide — está rodando de verdade, com pedidos reais da Daniela no piloto. A proposta é colocar em produção acompanhando um ciclo completo de compras.'));

kids.push(new Paragraph({ children: [new PageBreak()] }));

// PLANO B
kids.push(h1('6. Plano B — se algo falhar ao vivo'));
kids.push(tabela(['Sintoma', 'Ação imediata'], [
  ['E-mail não vira pedido em 2 min', 'Reenviar o e-mail (o gatilho lê a cada minuto e só pega e-mails novos). Enquanto isso, mostrar o painel com o Pedido 2.'],
  ['Bella não responde no WhatsApp', 'Conferir se a mensagem partiu de número autorizado (seu ou da Daniela). Plano C: mostrar a conversa do piloto real no seu celular.'],
  ['Painel não carrega', 'F5; conferir interstício do Chrome; alternativa: abrir a planilha direto e mostrar os dados chegando.'],
  ['Aviso vermelho do Chrome na frente do cliente', 'Falar com naturalidade: "classificação automática incorreta já contestada no Google — ambiente nosso, certificado válido". Detalhes → acessar.'],
  ['Internet/n8n fora', 'Apresentar pelos prints + planilha: a narrativa das telas está neste roteiro. Reagendar só a parte ao vivo.'],
], [3300, 6600]));

// Q&A
kids.push(h1('7. Perguntas prováveis e respostas curtas'));
kids.push(tabela(['Pergunta', 'Resposta'], [
  ['E se a IA errar?', 'Ela nunca compra sozinha. Tudo passa pela Daniela no painel; a IA registra, valida e prepara. E o que ela não entende, ela pergunta — não inventa (regra de projeto).'],
  ['Isso substitui a Daniela?', 'Não — tira dela a digitação e a caça de informação. A decisão de compra, negociação e relacionamento continuam humanos.'],
  ['Quanto custa rodar?', 'Infra atual: VPS + WhatsApp API + IA por uso (centavos por pedido). Custo operacional muito abaixo de 1 hora/dia do time.'],
  ['E a segurança dos dados?', 'Planilha no Google Drive da empresa, acesso por credencial, painel com token. Migração futura para banco dedicado já mapeada no blueprint.'],
  ['Funciona com nosso ERP?', 'A fila é estruturada (pedido, item, categoria, status) — integrável por planilha/API. Fase de integração está no roadmap do blueprint.'],
  ['Requisitante precisa aprender algo?', 'Não. Continua mandando e-mail ou WhatsApp como sempre — a Bella se adapta ao canal, não o contrário.'],
], [2900, 7000]));

// MAPA TECNICO
kids.push(h1('8. Mapa técnico rápido (para perguntas de bastidor)'));
kids.push(tabela(['Peça', 'Função', 'Estado'], [
  ['WF3 Triagem (v1.4)', 'E-mail → fila (multimodal: lê PDF e foto de requisição)', 'ATIVO'],
  ['WF6 Bella WhatsApp (v1.1)', 'Pedidos, complementos com memória, status', 'ATIVO'],
  ['WF4 Painel (v1.5)', 'Painel + revalidação IA + cotação por fornecedor', 'ATIVO'],
  ['Router uazapi (v1.3)', 'Recebe WhatsApp e distribui (Locações + Bella)', 'ATIVO'],
  ['WF2 Locações (v1.3)', 'Respostas de devolução/renovação (mudo fora disso)', 'ATIVO'],
  ['WF1 Alerta Diário', 'Alertas de locação (disparo manual na demo)', 'MANUAL'],
  ['Planilha Google', 'Banco de dados: PEDIDOS, MEMORIA, COTACOES, REQUISITOS…', 'OK'],
], [3100, 4800, 2000]));

const doc = new Document({
  numbering,
  styles: { default: { document: { run: { font: 'Segoe UI', size: 21 }, paragraph: { spacing: { line: 264 } } } } },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync('Roteiro Apresentacao Demo v2.0.docx', b);
  console.log('OK', b.length, 'bytes');
});
