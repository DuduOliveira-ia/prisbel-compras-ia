// FONTE: WF4 - Painel Daniela (ATIVO).json → node "Prep Revalida" (n8n-nodes-base.code)
// Extraído por scripts/extract_prompts.mjs — a fonte da verdade é o servidor n8n.
// ATENÇÃO: strings de prompt são double-quoted; nunca inserir " sem escape ao editar.

const b = $('API Salvar').first().json.body || {};
const v = Array.isArray(b.values) ? b.values : [];
const precisa = b.aba === 'PEDIDOS' && String(v[11] || '') === 'PENDENTE';
if (!precisa) return [{ json: { precisa: false, rn: 0, body: { contents: [{ role: 'user', parts: [{ text: 'responda apenas: ok' }] }], generationConfig: { temperature: 0, maxOutputTokens: 5 } } } }];
const SYSTEM = "Você é a Bella, assistente de compras da construtora Prisbel. A compradora editou um item de pedido no painel. Avalie se ainda falta informação essencial para cotar o item. Se o campo de pendências contém a própria resposta (ex.: pendência era 'tipo (soldável/roscável)' e o texto agora diz 'Soldável'), incorpore a informação à descrição do item e considere a pendência resolvida. Designações como CP2/CP II (cimento), AC1/AC2/AC3 (argamassa), CA-50/CA-60 (vergalhão) já são a classe. Responda SOMENTE JSON: {\"status\": \"COMPLETO\"|\"PENDENTE\", \"item\": \"descrição final com todas as especificações\", \"pendencias\": \"o que ainda falta, ou string vazia\"}. NUNCA invente dados.";
const user = 'ITEM: ' + (v[7] || '') + '\nQUANTIDADE: ' + (v[8] || '') + ' ' + (v[9] || '') + '\nCATEGORIA: ' + (v[10] || '') + '\nPENDÊNCIAS (texto editado pela compradora): ' + (v[12] || '(vazio)');
return [{ json: { precisa: true, rn: Number(b.row_number), body: { system_instruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } } } }];
