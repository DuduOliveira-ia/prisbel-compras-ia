# ADR-001 — Arquitetura de Conhecimento da Bella (v1.1)

Data: 23/07/2026 · Status: ACEITO (revisado com o Eduardo) · Substitui v1.0

## Mudanças da v1.1 (decisões do Eduardo em 23/07)

1. **Camada 2 nasce em Google Sheets**, com nomes de abas/campos IDÊNTICOS ao futuro
   schema SQL. Migração ao Supabase depois, como operação mecânica (CSV → import →
   trocar nó de leitura). Motivos: Daniela edita onde já trabalha; zero infra nova;
   conta Supabase compartilhada com projeto sensível (CULTOPPS) exige cautela — nada
   será criado lá sem OK explícito do Eduardo.
2. **Camada 3 SEM RAG vetorial no início** ("RAG-lite"): filtro determinístico por
   obra + documento INTEIRO no contexto do Gemini (1M tokens comporta um memorial).
   Sem chunks perdidos, sem embeddings, alinhado ao "nunca inventar". pgvector só
   se o acervo ultrapassar o contexto ou o custo por chamada incomodar.

## Arquitetura (revisada)

### Camada 1 — System prompt (git, `prompts/`)
Persona, calibrações de domínio, estilo de pergunta, regra "nunca inventar".
Atualização por deploy, versionada.

### Camada 2 — Tabelas (Sheets agora, Supabase depois; MESMO schema)
Fatos exatos, atualização frequente, relacionados por obra. Consulta determinística.
Schema congelado em `docs/Esquema de Dados Bella v1.0.md` — é o CONTRATO; renomear
campo exige nova versão do documento e migração formal.

### Camada 3 — Documentos por obra (RAG-lite)
Pasta/aba de documentos indexada por `obra_id` (memorial descritivo, quadros de
materiais). O bella-brain seleciona o(s) documento(s) da obra e injeta no contexto.

### Ordem de consulta (fluidez)
regras do prompt → lookup nas tabelas → documento da obra no contexto → "Não
encontrei" + escalonamento à Daniela.

## Disciplinas obrigatórias

- `obra_id` em toda linha relacionável, desde o dia 1 (Postgres validará FK depois).
- IDs estáveis e opacos (OB-001, FOR-001, CT-001…), nunca nome como chave.
- Datas ISO (AAAA-MM-DD), decimais com ponto — formato SQL-ready já na planilha.
- Sem fórmulas nas colunas de dados (fórmula não migra; usar abas auxiliares se preciso).

## Alternativas rejeitadas

(v1.0 mantidas) Tudo-RAG, tudo-tabela, tudo-prompt. Adicionada: **Supabase imediato** —
rejeitado por prudência com a conta compartilhada e para não introduzir infra antes
do comportamento estar validado com a Daniela.
