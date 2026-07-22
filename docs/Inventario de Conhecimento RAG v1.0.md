# Inventário de Conhecimento — RAG da Bella (v1.0)

22/07/2026 · Sprint 1 ("Bella sabe das coisas"). Mapeia cada fonte de conhecimento,
seu estado e o que falta pedir. Pasta de conhecimento estruturado: `knowledge/`.

## Fontes já disponíveis (pasta `D:\SSYS\CLIENTES\Prisbel`)

| Fonte | Estado | Uso no RAG |
|---|---|---|
| **Tabela de Compras R.09** (PDF de xlsx, 9 pág, 42 materiais) | ✅ Estruturada em `knowledge/tabela-compras-r09-materiais.md` | **Núcleo do motor de perguntas**: especificações mínimas por material + NBR + exigências de qualidade. É a "planilha 09" citada pelo Dono. |
| **Mapa do Dpto COMPRAS Rev.02** (PDF, 2 pág) | ✅ Estruturado em `knowledge/processo-compras-mapa-depto.md` | Processo formal: Requisição → Mapa de Coleta → Diretoria → AF → OC Totvs. Define onde a Bella prepara e onde o humano aprova. |
| **Requisição 511** (PDF, form FO-17/SGQ, obra Paradiso) | ✅ Legível (692 chars) | Exemplo real de requisição: campos do formulário, linguagem dos itens (EPI/limpeza), "urgente" sem justificativa. Vira caso de teste do QA. |
| **PLANILHA DE EQUIPAMENTOS LOCADOS.xlsx** (81 linhas) | ✅ Legível (OBRA, MATERIAL, QUANT., EMPRESA, DATA INÍCIO, Nº CONTRATO, SITUAÇÃO, VALOR) | Domínio locações (WF1/WF2). Fora do escopo compras do Sprint 1; já coberto pela planilha saneada do agente de locações. |
| **Email Levantamento 1 e 2** (PDF escaneado) | ⚠ Sem texto extraível — precisa OCR/multimodal | Baixa prioridade; conteúdo provavelmente coberto pelas transcrições. |
| **Transcrições 1, 2 e Reunião 2** (txt) | ✅ Lidas | Fonte de requisitos e casos de teste (lona 200 micras, bloco 12 MPa, caixinha 4x4, EPI); não entram no RAG como conhecimento factual. |
| Blueprint v1.2, checkpoint, roteiros (repo `DEV/`) | ✅ No git | Documentação interna do projeto; não é conhecimento da Bella. |

## Fontes a PEDIR (dependência humana — bloqueiam a profundidade do RAG)

Prioridade na ordem. Pedir à Daniela / Luís Eduardo:

1. **Memorial Descritivo** das obras ativas (Paradiso, Vinhático…) — "isso para mim é ouro": especificação de acabamentos (vasos, cerâmica, metais…). O Dono prometeu enviar na reunião de 15/07.
2. **Contratos/preços fechados** (cimento nacional, argamassa Farça Bartô, aço CSN, blocos Blojaf…): fornecedor, preço, vigência, pedido mínimo, frete CIF/FOB, condição (ex.: permuta 70/30). Não existe estruturado em lugar nenhum — sem isso não há motor "contratado → AF direta".
3. **Quadros de materiais** dos projetos (estrutural, elétrico, hidráulico — Davi/projetista) — quantitativos por pavimento (ex.: blocos por MPa).
4. **Tabela de Compras R.09 em .xlsx original** — conferir a reconstrução (2 itens com pareamento inferido ⚠).
5. **Cadastro de fornecedores** (razão social, CNPJ, contatos e-mail/telefone — Daniela disse que lista do Totvs).
6. **Planilha Qualificação e Avaliação de Fornecedores** + mapas de coleta de exemplo (bloco, EPI já vistos na reunião).
7. **Cadastro de obras**: nome, endereço/cidade, recursos (grua, bomba…), participantes (requisitante, almoxarife, engenheiro) — hoje só na cabeça das pessoas; alimenta a memória de fatos (E8).

## Arquitetura de destino (decidida na análise de 22/07)

- `knowledge/` versionado no git = fonte dos fatos estruturados (markdown).
- Serviço **bella-brain** (VPS, EasyPanel) indexa `knowledge/` + documentos brutos (memorial etc.) e expõe `POST /ask` para os workflows n8n.
- Aprendizados em runtime ("Paradiso tem grua") vão para uma base FATOS com carimbo de origem — nunca inventados, sempre confirmados por humano antes de virarem verdade.
