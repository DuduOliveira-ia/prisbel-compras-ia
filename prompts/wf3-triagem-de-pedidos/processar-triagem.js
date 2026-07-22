// FONTE: WF3 - Triagem de Pedidos (ATIVO).json → node "Processar triagem" (n8n-nodes-base.code)
// Extraído por scripts/extract_prompts.mjs — a fonte da verdade é o servidor n8n.
// ATENÇÃO: strings de prompt são double-quoted; nunca inserir " sem escape ao editar.

// ===== Processa a triagem: fila, rascunhos, aviso =====
const cfg = $('Config').first().json;
const m = $('Montar prompt triagem').first().json;
const forn = $('Ler FORNECEDORES').all().map(i => i.json);
const pedidos = $('Ler PEDIDOS').all().map(i => i.json);
let t = {};
try { const raw = $json.candidates?.[0]?.content?.parts?.[0]?.text || ''; t = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch (e) { t = { e_pedido: false, parse_error: true }; }
const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const dh = String(agora.getDate()).padStart(2,'0') + '/' + String(agora.getMonth()+1).padStart(2,'0') + '/' + agora.getFullYear() + ' ' + String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');
if (!t.e_pedido) {
  return [{ json: { tipo: 'nao_pedido', email_id: m.email_id, linhas: [], rascunhos: [],
    aviso_para: cfg.EMAIL_DANIELA, aviso_assunto: '[Bella] E-mail não classificado como pedido' + (t.parse_error ? ' (erro de leitura)' : ''),
    aviso_corpo: 'Assunto: ' + m.assunto + '\nRemetente: ' + m.remetente + '\nNenhuma ação tomada — verifique manualmente se necessário.' } }];
}
let num = 0; for (const p of pedidos) { const n = Number(p['Nº PEDIDO']); if (n > num) num = n; } num++;
const urg = t.urgente === true; const urgSemMotivo = urg && !t.motivo_urgencia;
const linhas = [], pendentes = [], completos = []; let seq = 0;
for (const it of (t.itens || [])) {
  const faltas = (it.campos_faltantes || []).slice();
  if (urgSemMotivo && !faltas.includes('motivo da urgência')) faltas.push('motivo da urgência');
  const status = faltas.length ? 'PENDENTE' : 'COMPLETO';
  linhas.push({ 'Nº PEDIDO': num, 'ITEM Nº': ++seq, 'DATA/HORA': dh, 'REMETENTE': m.remetente, 'NOME': '', 'OBRA': t.obra || '', 'URGENTE': urg ? 'SIM' : 'NÃO', 'MOTIVO URGÊNCIA': t.motivo_urgencia || '', 'ITEM': it.descricao || '', 'QUANT.': it.quantidade ?? '', 'UNID.': it.unidade || '', 'CATEGORIA': it.categoria || 'GERAL', 'STATUS': status, 'PENDÊNCIAS': faltas.join('; '), 'EMAIL_ID': m.email_id, 'OBS': '' });
  (faltas.length ? pendentes : completos).push({ ...it, faltas });
}
const rascunhos = [];
if (pendentes.length) {
  const corpo = 'Olá!\n\nRecebemos seu pedido (nº ' + num + '), mas faltam informações para prosseguir:\n\n' + pendentes.map(p => '• ' + (p.descricao || '?') + ' — falta: ' + p.faltas.join(', ')).join('\n') + '\n\nPor favor, responda este e-mail com os dados acima.\n\nBella — Assistente de Compras | Prisbel Construtora';
  rascunhos.push({ para: m.remetente, assunto: 'Pedido ' + num + ' — informações pendentes', corpo });
}
const porCat = {};
for (const c of completos) { const k = (c.categoria || 'GERAL').toUpperCase(); (porCat[k] = porCat[k] || []).push(c); }
for (const cat of Object.keys(porCat)) {
  const itens = porCat[cat];
  let f = forn.filter(x => String(x['CATEGORIA']).toUpperCase() === cat);
  if (!f.length) f = forn.filter(x => String(x['CATEGORIA']).toUpperCase() === 'GERAL');
  const dest = [...new Set(f.map(x => x['E-MAIL']).filter(Boolean))].join(', ') || cfg.EMAIL_DANIELA;
  const corpo = 'Prezados, bom dia!\n\nGentileza cotar os materiais abaixo, posto obra ' + (t.obra || '(a confirmar)') + ':\n\n' + itens.map(i => '• ' + (i.quantidade ?? '') + ' ' + (i.unidade || '') + ' — ' + i.descricao).join('\n') + '\n\nFavor informar prazo de entrega e condições de pagamento.\n\nAtenciosamente,\nBella — Assistente de Compras | Prisbel Construtora';
  rascunhos.push({ para: dest, assunto: 'Cotação ' + cat + ' — Pedido ' + num + (t.obra ? ' — obra ' + t.obra : ''), corpo });
}
const resumo = 'Pedido nº ' + num + ' triado.\nRemetente: ' + m.remetente + '\nObra: ' + (t.obra || '—') + '\nUrgente: ' + (urg ? ('SIM' + (t.motivo_urgencia ? ' (' + t.motivo_urgencia + ')' : ' — SEM MOTIVO INFORMADO')) : 'não') + '\nItens: ' + linhas.length + ' (' + completos.length + ' completos, ' + pendentes.length + ' pendentes)\nRascunhos prontos na caixa do ssysbot: ' + rascunhos.length + '\n\n' + linhas.map(l => '• [' + l['STATUS'] + '] ' + l['ITEM'] + (l['PENDÊNCIAS'] ? ' — falta: ' + l['PENDÊNCIAS'] : '')).join('\n');
return [{ json: { tipo: 'pedido', email_id: m.email_id, linhas, rascunhos, aviso_para: cfg.EMAIL_DANIELA, aviso_assunto: '[Bella] Pedido ' + num + ' triado — ' + completos.length + ' ok / ' + pendentes.length + ' pendente(s)', aviso_corpo: resumo } }];
