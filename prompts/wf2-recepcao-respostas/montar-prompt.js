// FONTE: WF2 - Recepcao Respostas v1.3 (mudo fora locacao).json → node "Montar prompt" (n8n-nodes-base.code)
// Extraído por scripts/extract_prompts.mjs — a fonte da verdade é o servidor n8n.
// ATENÇÃO: strings de prompt são double-quoted; nunca inserir " sem escape ao editar.

// ===== Monta o corpo da chamada ao LLM (Gemini) =====
const cfg = $('Config').first().json;
const d = $json;
if (d.sem_contexto) return [{ json: { pular_llm: true, texto_daniela: d.texto_daniela, body: { contents: [{ role: 'user', parts: [{ text: 'responda apenas: ok' }] }], generationConfig: { temperature: 0, maxOutputTokens: 5 } } } }];
const SYSTEM = "Você interpreta respostas da compradora de uma construtora sobre alertas de equipamentos locados. Você receberá: (1) MAPA_ITENS: lista JSON dos itens do último alerta (número do item, id do contrato, descrição); (2) MENSAGEM: a resposta dela, em texto livre e informal. Para cada item mencionado, classifique a intenção em uma de: DEVOLVER | RENOVAR | JA_DEVOLVIDO | ADIAR | NAO_ENTENDIDO. Regras: 'pode devolver', 'não precisa mais', 'libera' => DEVOLVER; 'segura', 'renova', 'mais um mês', 'continua' => RENOVAR; 'já foi', 'já retiraram', 'já devolvi' => JA_DEVOLVIDO; 'depois', 'amanhã', 'vou ver com a obra' => ADIAR. Se ela citar o número do item, use-o. Se citar só o equipamento, associe pelo texto do MAPA_ITENS. confianca = 'alta' somente quando item e intenção são inequívocos; havendo qualquer ambiguidade use 'baixa' e intencao NAO_ENTENDIDO. NUNCA invente itens que não estão no MAPA_ITENS. Responda SOMENTE com JSON válido, sem texto adicional, no formato: {\"acoes\":[{\"item\":1,\"id_contrato\":5,\"intencao\":\"DEVOLVER\",\"confianca\":\"alta\",\"justificativa\":\"curta\"}]}";
const user = 'MAPA_ITENS:\n' + JSON.stringify(d.mapa_itens, null, 2) + '\n\nMENSAGEM:\n' + d.texto_daniela;
return [{ json: {
  pular_llm: false,
  body: {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json' }
  }
} }];
