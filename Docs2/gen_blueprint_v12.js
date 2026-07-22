const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, TableOfContents, PageBreak, convertInchesToTwip
} = require('docx');
const fs = require('fs');

const VERDE = '1E6B52';      // verde institucional (Prisma)
const CINZA = 'F2F2F2';
const CINZA_ESC = '595959';

const bullet = (text, opts = {}) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  spacing: { after: 80 },
  children: [new TextRun({ text, size: 22, ...opts })]
});

const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 140 },
  alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, size: 22, ...opts })]
});

const pRuns = (runs) => new Paragraph({
  spacing: { after: 140 },
  alignment: AlignmentType.JUSTIFIED,
  children: runs.map(r => new TextRun({ size: 22, ...r }))
});

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text, color: VERDE, bold: true, size: 30 })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, color: '333333', bold: true, size: 25 })] });

function cell(text, { width, bold = false, shade = null, size = 20 } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size })] })]
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { width: widths[i], bold: true, shade: VERDE, size: 20 })).map(c => c)
      }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((t, i) => cell(t, { width: widths[i], shade: ri % 2 ? CINZA : null }))
      }))
    ]
  });
}

// header row white text fix: rebuild header cells with white bold text
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: VERDE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF' })] })]
  });
}
function tbl(headers, rows, widths) {
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((t, i) => cell(t, { width: widths[i], shade: ri % 2 ? CINZA : null }))
      }))
    ]
  });
}

const children = [];

// ===== CAPA =====
children.push(
  new Paragraph({ spacing: { before: 2200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BLUEPRINT', bold: true, size: 56, color: VERDE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Processo de Compras Apoiado por IA', bold: true, size: 36, color: '333333' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: 'Departamento de Compras — Grupo Muniz Rabelo (Prisbel / Prisma)', size: 24, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Versão 1.2 — 18 de Julho de 2026 (v1.1: 16/07 | v1.0: 15/07)', size: 22, color: CINZA_ESC })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Elaborado a partir do levantamento realizado com Daniela Cançado (Compras)', italics: true, size: 20, color: CINZA_ESC })] }),
  new Paragraph({ children: [new PageBreak()] })
);

// ===== 1. SUMARIO EXECUTIVO =====
children.push(
  h1('1. Sumário executivo'),
  p('Este blueprint descreve como estruturar o processo de compras da Prisbel/Prisma com apoio de inteligência artificial, tomando como base o levantamento realizado com a Daniela (Depto. de Compras), o Mapa do Departamento (Rev. 02), a Tabela de Compras R.09, a planilha de equipamentos locados, requisições e e-mails reais do dia a dia.'),
  p('O diagnóstico central: o processo formal existe e é bom (há procedimento da qualidade, formulário de requisição, tabela de especificações mínimas e mapa de coleta), mas na prática ele é executado de forma manual e multicanal, com requisições incompletas, tudo classificado como "urgente" e controles em planilhas sem alertas. A Daniela funciona hoje como o "filtro humano" de todo o sistema — e é exatamente esse filtro que a IA pode assumir em grande parte.'),
  p('A proposta para o MVP tem dois módulos, escolhidos por retorno rápido e baixa dependência de sistemas:'),
  bullet('Módulo A — Agente de Locações: monitora os contratos de equipamentos locados e dispara alertas de vencimento e devolução para a Daniela e para as obras. Retorno financeiro direto: hoje equipamento parado passa batido e gera meses de locação desnecessária.'),
  bullet('Módulo B — Triagem inteligente de requisições: a IA recebe as requisições (e-mail), confere contra os requisitos mínimos da Tabela de Compras R.09 e devolve automaticamente as pendências ao requisitante, entregando à Daniela apenas requisições completas e organizadas em fila única.'),
  p('A integração com o Totvs fica fora do MVP e entra como fase futura do roadmap. A IA não fecha compra nem aprova nada sozinha — decisão e negociação permanecem com a Daniela e a diretoria.')
);

// ===== 2. CONTEXTO =====
children.push(
  h1('2. Contexto e fontes analisadas'),
  p('O Departamento de Compras atende as obras da Prisbel e da Prisma (ex.: Paradiso, Arbo, Loteamento Celebration), com uma compradora (Daniela) e apoio de auxiliar. Ferramentas atuais: Totvs (cadastro de fornecedores, ordem de compras, financeiro), SharePoint (documentação da qualidade), e-mail, WhatsApp e planilhas Excel.'),
  h2('Fontes deste blueprint'),
  tbl(
    ['Fonte', 'O que revela'],
    [
      ['Transcrições do levantamento (2 sessões)', 'Como o processo funciona de fato: recepção de pedidos, dúvidas com requisitantes, cotação, mapa de coleta, locações.'],
      ['Mapa do Departamento — COMPRAS Rev. 02 (Abr/22)', 'Processo formal da qualidade: entradas, atividades, saídas e indicadores do setor.'],
      ['Tabela de Compras R.09', 'Especificações mínimas de compra para 42 materiais controlados, com referências normativas (NBR) e exigências de qualidade.'],
      ['Requisição nº 511 (obra Paradiso)', 'Formulário padrão em uso: itens sem código, sem especificação (ex.: luvas sem tamanho) e previsão de entrega "urgente".'],
      ['Planilha de Equipamentos Locados', 'Controle manual de ~80 contratos de locação por obra, com valores e situação, sem alertas de vencimento.'],
      ['E-mails (cotação de EPI e cobrança de fornecedor)', 'Cotação feita item a item por e-mail e cobranças chegando na mesma caixa de entrada.']
    ],
    [3400, 5960]
  )
);

// ===== 3. AS-IS =====
children.push(
  h1('3. Processo atual (AS-IS)'),
  p('Fluxo consolidado a partir do Mapa do Departamento e do levantamento com a Daniela:'),
  tbl(
    ['#', 'Etapa', 'Como acontece hoje', 'Ferramenta'],
    [
      ['1', 'Demanda da obra', 'Requisitante (almoxarife, engenheiro, técnica de segurança) emite requisição numerada por obra — mas pedidos também chegam por e-mail avulso, WhatsApp e telefone.', 'Formulário / e-mail / WhatsApp'],
      ['2', 'Entendimento do pedido', 'Daniela confere o que foi pedido; quando falta especificação, liga ou escreve para o requisitante ou para o encarregado técnico (ex.: Cleiton, elétrica).', 'Telefone / WhatsApp'],
      ['3', 'Cotação', 'E-mail individual para cada fornecedor cadastrado (copiar/colar). Fornecedores respondem em formatos diferentes.', 'E-mail'],
      ['4', 'Mapa de coleta', 'Consolidação manual dos preços em planilha; conferência manual de quantidades e totais (≈1h por mapa). Melhor preço identificado por fórmulas.', 'Excel'],
      ['5', 'Aprovação e fechamento', 'Mapa aprovado pela diretoria (Luiz negocia os itens de maior valor); emissão da Ordem de Compras no Totvs.', 'Totvs'],
      ['6', 'Entrega e conferência', 'Confirmação com o almoxarifado da obra; "OK" na OC; NFs lançadas no financeiro do Totvs e baixadas na planilha de compras.', 'Totvs / Excel'],
      ['7', 'Pós-compra', 'Avaliação periódica de fornecedores (trimestral/bimestral), relatório mensal para a diretoria, controle de locações em planilha.', 'Excel / SharePoint']
    ],
    [500, 1800, 5260, 1800]
  ),
  h2('Regras de negócio relevantes'),
  bullet('Materiais controlados (aço, cimento, blocos, concreto etc.) exigem especificação técnica conforme a Tabela R.09, três cotações e controles de qualidade (ensaios, laudos, licenças) — há auditoria da qualidade.'),
  bullet('Materiais comuns (EPI, limpeza, ferramentas) têm processo mais simples, sem exigência de três cotações para valores pequenos.'),
  bullet('Não se pode dividir a compra de bloco estrutural entre fornecedores diferentes (risco estrutural/qualidade) — a decisão é pelo pacote.'),
  bullet('Contratos de fornecimento contínuo (bloco, concreto) geram pedidos recorrentes ao longo da obra.'),
  bullet('Locações são cobradas em ciclos mensais, quinzenais, semanais ou diária/data específica, conforme o equipamento.')
);

// ===== 4. GARGALOS =====
children.push(
  h1('4. Gargalos identificados'),
  p('Cada gargalo abaixo tem evidência direta no levantamento. A coluna "IA resolve?" indica o grau em que tecnologia responde ao problema — em alguns casos o gargalo é de processo/cultura e a IA apenas apoia.'),
  tbl(
    ['Gargalo', 'Evidência', 'Impacto', 'IA resolve?'],
    [
      ['G1. Requisições incompletas', 'Luvas sem tamanho; tomada sem amperagem; quadro sem definir barramento; condulete sem polegada. Daniela liga/escreve para completar.', 'Horas de retrabalho por semana; risco de compra errada.', 'Alto — validação automática contra requisitos mínimos.'],
      ['G2. Multicanal sem fila única', 'Pedidos por e-mail, WhatsApp e telefone; "são muitos, passa batido"; cobrança de EPI que ninguém viu.', 'Pedidos perdidos, desgaste com as obras.', 'Alto — captura e consolidação em fila única com status.'],
      ['G3. Tudo é urgente', 'Requisição 511: previsão de entrega = "urgente". "Quando tudo é urgente, nada é urgente."', 'Sem programação de compras; frete e preço piores.', 'Médio — regra de justificativa + relatório de urgências; a mudança é de processo.'],
      ['G4. Cotação manual', 'E-mail um a um; respostas em formatos distintos; conferência manual de quantidades (≈1h por mapa).', 'Tempo alto por cotação; erros de digitação.', 'Alto — RFQ padronizado e consolidação automática (fase 2).'],
      ['G5. Locações sem alerta', 'Planilha manual; "já era para ter devolvido, ficou dois meses e você pagou". Erro de digitação na base (data "3117").', 'Prejuízo direto e recorrente; multiplicado por ~80 contratos ativos.', 'Alto — alertas automáticos de vencimento/devolução.'],
      ['G6. Patrimônio de ferramentas próprias sem controle', 'Plaquetas de patrimônio entregues duas vezes, nunca implantadas nas obras.', 'Perda/roubo sem baixa; recompra desnecessária.', 'Médio — depende de disciplina na obra; IA ajuda no registro.'],
      ['G7. Cultura de não usar o sistema', 'Requisitantes não registram no Totvs; formulário nem sempre usado; "mudar a cultura é mais difícil que mudar o sistema".', 'Dados incompletos; controles paralelos.', 'Baixo direto — mas a IA reduz o atrito ao tornar o caminho certo o mais fácil.'],
      ['G8. Indicadores manuais', 'Planilha de compras alimentada à mão para gerar indicador de comprado x gasto por obra.', 'Visão gerencial atrasada e trabalhosa.', 'Alto — subproduto automático da fila única (fase 3).']
    ],
    [1850, 3100, 2300, 2110]
  )
);

// ===== 5. TO-BE =====
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('5. Processo futuro (TO-BE) com IA'),
  h2('Princípios de desenho'),
  bullet('Humano no comando: a IA prepara, valida, alerta e organiza. Quem decide, negocia e fecha é a Daniela; quem aprova é a diretoria. Nenhuma compra é efetuada automaticamente.'),
  bullet('Processo antes da ferramenta: os requisitos mínimos da Tabela R.09 viram a "régua" da IA. O que não estiver parametrizado, a IA pergunta — e o aprendizado alimenta a base.'),
  bullet('Caminho fácil = caminho certo: o requisitante continua mandando e-mail (e futuramente WhatsApp); é a IA que estrutura, não a pessoa que muda de hábito.'),
  bullet('Compatível com a qualidade/auditoria: tudo que a IA fizer gera registro (quem pediu, quando, o que faltou, quem respondeu), fortalecendo a rastreabilidade exigida pela ISO.'),
  h2('Fluxo TO-BE por etapa'),
  tbl(
    ['Etapa', 'Papel da IA', 'Papel humano'],
    [
      ['Recepção da demanda', 'Lê e-mails de compras@, extrai itens, quantidades, obra e requisitante; registra tudo em fila única com número e status.', 'Requisitante envia como já envia hoje.'],
      ['Validação da requisição', 'Confere cada item contra os requisitos mínimos (Tabela R.09 + base de perguntas frequentes); responde ao requisitante listando exatamente o que falta; reenvia quando completo.', 'Daniela só vê requisições completas; casos ambíguos escalam para ela.'],
      ['Priorização', '"Urgente" exige motivo; IA monta a programação de compras da semana e aponta o que pode ser agrupado.', 'Daniela define a ordem final; diretoria audita urgências.'],
      ['Cotação (fase 2)', 'Gera RFQ padronizado para os fornecedores cadastrados do grupo de material; lê as respostas e monta o mapa de coleta automaticamente, conferindo quantidades e totais.', 'Daniela revisa o mapa, negocia e recomenda; diretoria aprova.'],
      ['Fechamento', 'Prepara resumo para aprovação e minuta da OC.', 'Emissão da OC no Totvs (manual no MVP; integrada na fase 3).'],
      ['Entrega e NF', 'Cobra confirmação de entrega da obra; cruza NF x OC e aponta divergências (fase 3).', 'Almoxarife confirma; Daniela trata divergências.'],
      ['Locações', 'Base estruturada de contratos com ciclo de cobrança; alertas de vencimento e devolução para Daniela e almoxarifes; pergunta à obra "devolver ou renovar?".', 'Obra decide devolver/renovar; Daniela formaliza com o fornecedor.'],
      ['Gestão', 'Indicadores automáticos: comprado x previsto por obra, tempo de ciclo, % urgências, custo de locação por obra (fase 3).', 'Diretoria acompanha relatório mensal gerado automaticamente.']
    ],
    [1750, 4310, 3300]
  )
);

// ===== 6. MVP =====
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('6. MVP — escopo detalhado'),
  p('O MVP prioriza os módulos A (locações) e B (triagem de requisições), rodando ao lado do Totvs, sem integração. Critério da escolha: são os dois pontos com maior dor relatada, dados já disponíveis e resultado demonstrável em semanas — importante porque a diretoria "quer ver resultado".'),

  h2('Módulo A — Agente de Locações'),
  pRuns([{ text: 'Problema: ', bold: true }, { text: 'equipamento locado fica parado na obra depois do uso e a cobrança continua ("dois meses pagos à toa"). O controle atual é uma planilha alimentada à mão, sem datas de vencimento confiáveis nem alertas.' }]),
  pRuns([{ text: 'Solução: ', bold: true }, { text: 'transformar a planilha atual em uma base estruturada e colocar um agente monitorando os ciclos de cobrança.' }]),
  bullet('Cadastro por contrato: obra, equipamento, fornecedor, nº do contrato, valor, data de início, ciclo (mensal, quinzenal, semanal, diária ou data específica) e situação (em obra / devolução).'),
  bullet('Alertas automáticos X dias antes de cada renovação de ciclo, por WhatsApp/e-mail, para a Daniela E para o almoxarife da obra — com a pergunta objetiva: "ainda precisa? devolver ou renovar?".'),
  bullet('Regra de fim de semana: devolução prevista para sexta gera alerta antecipado (evitar pagar sábado/domingo).'),
  bullet('Painel simples: o que vence esta semana, o que está marcado para devolução e há quanto tempo, custo mensal de locação por obra.'),
  bullet('Entrada de novos contratos: a IA lê a NF/contrato de locação recebido por e-mail e sugere o cadastro preenchido para a Daniela confirmar.'),
  pRuns([{ text: 'Resultado esperado: ', bold: true }, { text: 'zero ciclos pagos de equipamento já dispensado. Com ~80 contratos ativos e itens de R$ 150 a R$ 11 mil/mês, evitar poucos ciclos indevidos por ano já paga o projeto.' }]),

  h2('Módulo B — Triagem inteligente de requisições'),
  pRuns([{ text: 'Versão inicial (B-v0) — decidida em 16/07/2026: ', bold: true }, { text: 'um nó de monitoramento na caixa Gmail captura todo e-mail que contenha "Prisbel"; a IA classifica se é solicitação de compra; sendo, extrai os materiais e confere cada item contra os requisitos mínimos (Tabela R.09 + base complementar); as pendências são enviadas por e-mail PARA A DANIELA, que encaminha ao solicitante. Racional: no primeiro contato, a obra continua ouvindo a Daniela — não um robô — o que reduz o risco cultural. Quando o fluxo estiver estabelecido, evolui para a resposta automática direta ao requisitante (com Daniela em cópia), conforme descrito abaixo.' }]),
  pRuns([{ text: 'Problema: ', bold: true }, { text: 'requisições chegam sem especificação (luvas sem tamanho, tomadas sem amperagem) e por vários canais. A Daniela gasta o dia perguntando e corre o risco de pedidos passarem batido.' }]),
  pRuns([{ text: 'Solução: ', bold: true }, { text: 'um agente conectado à caixa compras@ que faz a triagem antes de a requisição chegar à Daniela.' }]),
  bullet('Extração: lê o e-mail/anexo da requisição e estrutura itens, quantidades, unidades, obra e requisitante.'),
  bullet('Validação: confere cada item contra os requisitos mínimos — Tabela de Compras R.09 para materiais controlados e uma base complementar para itens comuns (EPI exige tamanho e CA; fio exige bitola, cor e metragem etc.).'),
  bullet('Devolução automática de pendências: responde ao requisitante com a lista exata do que falta, no tom certo, sem envolver a Daniela.'),
  bullet('Fila única: requisições completas entram numa fila com número, status e prioridade; nada mais se perde na caixa de entrada.'),
  bullet('Urgência com motivo: pedido urgente sem justificativa volta automaticamente; urgências ficam registradas para auditoria posterior.'),
  bullet('Escalonamento: dúvidas técnicas que a base não cobre são encaminhadas ao encarregado correto (ex.: elétrica → Cleiton), como a Daniela já faz manualmente hoje.'),
  pRuns([{ text: 'Resultado esperado: ', bold: true }, { text: 'redução drástica do vai-e-vem de esclarecimentos, nenhum pedido perdido, e a Tabela R.09 finalmente aplicada na entrada do processo (hoje ela existe, mas a obra não a usa).' }]),

  h2('Dados e preparação necessários (Fase 0)'),
  tbl(
    ['Item', 'Fonte', 'Responsável'],
    [
      ['Base de contratos de locação saneada (datas e ciclos corretos — há erros de digitação hoje)', 'Planilha de Equipamentos Locados', 'Daniela + apoio'],
      ['Requisitos mínimos por material comum (complemento da R.09 para EPI, limpeza, ferramentas)', 'Tabela R.09 + conhecimento da Daniela', 'Daniela + consultoria'],
      ['Lista de fornecedores com grupo de material e contato (nome, CNPJ, e-mail)', 'Totvs (exportação simples)', 'Daniela'],
      ['Mapa de papéis por obra (requisitantes, almoxarifes, encarregados técnicos)', 'Levantamento por empreendimento', 'Daniela + obras'],
      ['Acesso à caixa compras@grupomunizrabelo.com.br', 'TI', 'TI / consultoria']
    ],
    [4700, 2800, 1860]
  ),
  h2('Critérios de sucesso do MVP (90 dias)'),
  bullet('100% dos contratos de locação com alerta emitido antes do vencimento do ciclo; nenhum ciclo pago após pedido de devolução.'),
  bullet('≥ 80% das requisições recebidas por e-mail triadas automaticamente; pendências devolvidas em menos de 15 minutos.'),
  bullet('Percepção da Daniela: menos ligações de esclarecimento e fila única confiável (medir antes/depois em nº de idas e vindas por requisição).'),
  bullet('Demonstração mensal de resultado para a diretoria (valor de locação evitado + tempo economizado).')
);

// ===== 7. ROADMAP =====
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('7. Roadmap'),
  tbl(
    ['Fase', 'Escopo', 'Status / Duração'],
    [
      ['Fase 0 — Preparação', 'Sanear base de locações (planilha modelo v1.0 entregue); parametrizar requisitos mínimos; mapear papéis por obra; acessos.', 'Em andamento'],
      ['Fase 0.5 — Demo de venda (locações)', 'Versão mínima do Módulo A rodando: planilha Google + n8n + uazapi. Ciclo completo validado em 16/07/2026: alerta WhatsApp + resposta em linguagem natural + atualização automática da planilha + LOG de auditoria.', 'CONCLUÍDA'],
      ['Fase 1 — MVP', 'Módulo B-v0 IMPLEMENTADO E ACEITO em 18/07/2026 (WF3 ativo): gatilho Gmail, triagem e categorização por IA, validação contra requisitos (aba REQUISITOS), fila única com nº sequencial (aba PEDIDOS), rascunhos prontos de devolução ao solicitante e de cotação por categoria (aba FORNECEDORES), aviso-resumo à Daniela e idempotência. Pendente da Fase 1: alertas de locação aos almoxarifes; piloto com dados reais da Daniela.', 'B-v0 aceito; piloto pendente'],
      ['Fase 1b — Triagem direta', 'Módulo B completo: resposta automática de pendências direto ao requisitante (Daniela em cópia); fila única com número e status; regra de urgência com motivo.', 'após B-v0 estabilizado'],
      ['Fase 2 — Cotação assistida', 'RFQ padronizado por grupo de material; leitura das propostas; mapa de coleta gerado automaticamente com conferência de quantidades; histórico de preços. Canal WhatsApp de entrada (bot) para as obras.', 'após validação do MVP'],
      ['Fase 3 — Integração e gestão', 'Integração Totvs (fornecedores, OC, NF); cruzamento NF x OC; página de acompanhamento de pedidos para as obras ("cadê meu pedido?"); indicadores automáticos; relatório mensal automático para a diretoria. Migração da base de planilha para banco (Supabase) e da lógica n8n para código versionado.', 'após fase 2'],
      ['Fase 4 — Extensões', 'Controle de patrimônio de ferramentas próprias; programação de compras por cronograma de obra; API oficial da Meta no lugar do uazapi.', 'backlog']
    ],
    [2300, 5260, 1800]
  ),
  h2('Stack e time considerados neste roadmap'),
  p('Demo e MVP: n8n (orquestração, infraestrutura já existente com Ulisses) + uazapi (WhatsApp, número dedicado ao agente) + Google Sheets (base de dados auditável) + API Claude (classificação e extração). Time: Eduardo (condução técnica e de processo, com apoio de ferramentas de IA), Ulisses (n8n/uazapi), Daniela (especialista do processo, 2–4h/semana), Luiz (patrocínio). A partir da fase 3, a base migra para Supabase e a lógica para código versionado em git, reduzindo a dependência do n8n — decisão registrada em 16/07/2026.')
);

// ===== 8. RISCOS =====
children.push(
  h1('8. Riscos e pontos de atenção'),
  tbl(
    ['Risco', 'Mitigação'],
    [
      ['Adesão das obras (cultura): requisitante ignora a devolução de pendências da IA.', 'Patrocínio da diretoria; a resposta automática cita a diretriz da qualidade; relatório mensal expõe quem trava o processo.'],
      ['Qualidade dos dados de partida (ex.: datas erradas na planilha de locações).', 'Fase 0 dedicada a saneamento, com dupla conferência dos ciclos de cobrança contra as NFs.'],
      ['IA responder errado ao requisitante e gerar compra incorreta.', 'No piloto, respostas da IA passam pela Daniela (modo revisão) antes do envio; só depois de estabilizado o envio vira automático. IA nunca fecha compra.'],
      ['Dependência de uma pessoa (Daniela) para regras não documentadas.', 'Cada pergunta/resposta vira parâmetro registrado na base de requisitos — o conhecimento tácito é capturado ao longo do uso.'],
      ['Auditoria da qualidade (ISO) questionar o novo fluxo.', 'O fluxo TO-BE gera mais rastreabilidade que o atual; atualizar o Mapa do Departamento (Rev. 03) formalizando o agente como ferramenta do processo.'],
      ['Expectativa da diretoria por resultado rápido.', 'Começar pelo Módulo A, que demonstra valor em semanas e em reais (locação evitada).']
    ],
    [4200, 5160]
  )
);

// ===== 9. PROXIMOS PASSOS =====
children.push(
  h1('9. Próximos passos para validação'),
  bullet('1. Validar este blueprint com a Daniela (aderência ao dia a dia) e com o Luiz/diretoria (prioridades e patrocínio).'),
  bullet('2. Definir a obra-piloto e os 3 grupos de material do piloto de triagem (sugestão da conversa: bloco, EPI e ferramentas elétricas/locação).'),
  bullet('3. Executar a Fase 0 (saneamento e parametrização) com data marcada.'),
  bullet('4. Especificar o MVP tecnicamente (arquitetura, canal de alertas, modo revisão) — próximo documento após a validação deste.'),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Observação: os volumes financeiros citados (ex.: valores de locação) vieram da planilha fornecida; recomenda-se validar os totais com a Daniela antes da apresentação à diretoria.', italics: true, size: 20, color: CINZA_ESC })] })
);

// ===== 10. REGISTRO DE ALTERACOES =====
children.push(
  h1('10. Registro de alterações'),
  tbl(
    ['Versão', 'Data', 'Alterações'],
    [
      ['1.0', '15/07/2026', 'Emissão inicial para validação.'],
      ['1.2', '18/07/2026', 'Fase 0.5 concluída (ciclo locações validado ponta a ponta). Módulo B-v0 implementado, testado e aceito: WF3 Triagem de Pedidos ativo (Gmail → Gemini → fila PEDIDOS → rascunhos → aviso), com abas REQUISITOS e FORNECEDORES parametrizáveis pela compradora. LLM da triagem: Gemini (chave existente do projeto PRESTAI) — decisão de 18/07. Infra: workflows exportados como checkpoint v1.2; testes arquivados. Melhorias anotadas: refinar descrição de item no RFQ; extração do campo obra; migrar rascunhos p/ caixa da Daniela em produção.'],
      ['1.1', '16/07/2026', 'Roadmap: incluída Fase 0.5 (demo de locações — em execução, alerta WhatsApp validado com dados reais); incluído Módulo B-v0 (monitoramento Gmail "Prisbel" → classificação → validação de requisitos → pendências por e-mail à Daniela) e Fase 1b (triagem direta ao requisitante). Estratégia multicanal: entrada continua nos canais atuais (e-mail primeiro, WhatsApp bot na fase 2); consulta de status ("cadê meu pedido?") movida para a fase 3. Registrados stack e time da demo (n8n + uazapi + Google Sheets + API Claude) e a decisão de migrar para Supabase + código versionado a partir da fase 3.']
    ],
    [900, 1300, 7160]
  )
);

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 220 } } }
      }]
    }]
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } }
  },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Blueprint - Processo de Compras com IA - Prisbel v1.2.docx', buf);
  console.log('OK');
});
