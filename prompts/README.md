# prompts/ — prompts LLM da Bella (extraídos dos Code nodes)

Cada arquivo é o `jsCode` de um Code node que monta prompt para o Gemini,
extraído por `scripts/extract_prompts.mjs`.

**Fluxo de trabalho:**
1. Export fresco dos workflows (`node scripts/export_workflows.mjs`).
2. Re-extração (`node scripts/extract_prompts.mjs workflows/export-AAAA-MM-DD`).
3. Editar aqui, revisar no diff, e só então aplicar de volta via API (PUT no workflow).
4. Bounce obrigatório do workflow ativo após aplicar.

**Regras (ver CLAUDE.md):**
- Strings de prompt são double-quoted — nunca inserir `"` sem escape (use aspas simples dentro dos prompts).
- A fonte da verdade é o servidor n8n; estes arquivos são espelho para versionamento e revisão.

## Estado atual

Extraído em 22/07/2026 dos exports **locais** (v1.5/v1.2/v1.3 reconstruídos do
checkpoint 21/07 + diffs de 22/07) — **reconciliar com export fresco via API
assim que a N8N_API_KEY estiver disponível.**

| Pasta | Workflow | Node | Papel |
|---|---|---|---|
| wf3-triagem-de-pedidos | WF3 Triagem | Montar prompt triagem | Prompt principal de triagem de e-mails (multimodal) |
| wf3-triagem-de-pedidos | WF3 Triagem | Processar triagem | Pós-processamento da resposta do LLM |
| wf6-bella-whatsapp | WF6 Bella WhatsApp | Montar | Prompt conversacional (pedido/COMPLEMENTO/STATUS/OUTRO + memória) |
| wf4-painel-daniela | WF4 Painel | Prep Revalida | Prompt de revalidação ao salvar item no painel |
| wf2-recepcao-respostas | WF2 Locações | Montar prompt | Prompt do agente de locações (devolve/renova) |
