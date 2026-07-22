# ADR-001 — Arquitetura de Conhecimento da Bella (v1.0)

Data: 23/07/2026 · Status: PROPOSTO (aguardando validação do Eduardo)

## Contexto

A Bella precisa de conhecimento de 3 naturezas distintas: regras de domínio estáveis,
fatos exatos e relacionais (preços, contratos, obras) e documentos longos (memorial
descritivo, projetos). Critérios de decisão definidos pelo Eduardo: **frequência de
atualização, relacionamento das informações com cada obra e fluidez no uso diário.**

## Decisão

Arquitetura em 3 camadas, com alocação por tipo de informação — nunca "tudo RAG":

### Camada 1 — System prompt (git, `prompts/`)
Universal, estável, pequeno. Persona, calibrações de domínio (saco=unidade, CP2 é
classe, vedação sem MPa…), estilo de pergunta, regra "nunca inventar".
Atualização: por deploy, versionada, com diff revisável.

### Camada 2 — Tabelas relacionais (Supabase/Postgres)
Fatos exatos, atualização frequente, relacionamento por obra. Resposta determinística
via SQL — preço/contrato NUNCA vem de busca semântica (regra da casa nº 2).

| Tabela | Conteúdo | Atualiza |
|---|---|---|
| `obras` | nome, cidade/endereço, recursos (grua, bomba…), status | por obra nova |
| `pessoas` | requisitantes, almoxarifes, engenheiros ↔ obra, papel, telefone | eventual |
| `fornecedores` | razão social, CNPJ, contatos, avaliação, categorias | eventual |
| `contratos` | material ↔ fornecedor, preço, vigência, pedido mínimo, frete CIF/FOB, condições (permuta…) | frequente (Daniela) |
| `requisitos_minimos` | Tabela R.09: 42 materiais × campos obrigatórios × NBR × qualidade | rara |
| `fatos_aprendidos` | fato por obra aprendido em conversa, com origem e confirmação humana | contínua (auditável) |

### Camada 3 — RAG semântico (pgvector no MESMO Supabase)
Documentos longos consultados por significado: memorial descritivo por obra, quadros
de materiais dos projetos, procedimentos SGQ, catálogos. Metadado `obra_id` em cada
chunk para filtrar por obra antes da busca vetorial.
Atualização: por evento (nova obra / novo documento).

### Ordem de consulta no bella-brain (fluidez)
1. Regras do prompt (zero custo)
2. SQL nas tabelas (ms, exato)
3. RAG (só para dúvida documental)
4. Sem resposta → "Não encontrei" + escalonamento à Daniela

## Por que Supabase

- Postgres + pgvector: camadas 2 e 3 no mesmo banco, uma API, um backup.
- REST/RPC pronto → n8n consome via HTTP sem servidor extra no início.
- Resolve o roadmap item 5 (Sheets→banco) de forma incremental: Supabase entra como
  camada de conhecimento; PEDIDOS/MEMORIA continuam no Sheets (painel em produção)
  e migram depois, sem big-bang.
- Free tier suficiente para o piloto; MCP do Supabase disponível no ambiente de dev.

## Consequências

- O Sheets deixa de ser destino final de conhecimento novo (contratos, obras, fatos
  nascem no Supabase); abas atuais de conhecimento (REQUISITOS, FORNECEDORES) são
  migradas e congeladas.
- O painel da Daniela ganha, em fase 2, telas de manutenção de contratos/fatos.
- Segredos de acesso ficam no n8n (credencial HTTP) e no `.env` local — nunca no git.

## Alternativas rejeitadas

- **Tudo RAG**: preço/contrato por similaridade = risco de resposta plausível e errada;
  atualização diária de tabela viraria re-embedding constante; sem joins por obra.
- **Tudo em tabelas**: memorial descritivo não é estruturável sem perder conteúdo;
  perguntas abertas ("qual acabamento do hall?") precisam de semântica.
- **Tudo no system prompt**: não escala (custo/latência por token), sem atualização
  pela Daniela, sem relacionamento por obra.
