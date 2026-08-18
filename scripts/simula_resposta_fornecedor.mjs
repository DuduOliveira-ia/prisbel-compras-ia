// Simula a resposta de um fornecedor ao pedido de cotação, para testar o WF5
// de ponta a ponta sem depender de alguém digitar o e-mail na caixa do
// fornecedor. NÃO envia e-mail para ninguém: usa gmail.users.messages.insert
// para colocar a mensagem direto na caixa da Bella, com o From do fornecedor
// (que é como o WF5 identifica quem respondeu, via aba FORNECEDORES).
//
// Uso:
//   node scripts/simula_resposta_fornecedor.mjs --teste
//   node scripts/simula_resposta_fornecedor.mjs --de=btceog@gmail.com \
//        --pedido=29 --corpo="Bom dia! Segue nossa proposta: ..."
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const arg = (n, d) => {
  const a = process.argv.find(x => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const CAIXA_BELLA = arg('para', 'ssysbot@gmail.com');

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method, headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// workflow temporário com credencial Gmail da Bella, mesmo padrão dos outros scripts
const p = 'prisbel-temp-inbox-' + Math.random().toString(36).slice(2, 8);
const wf = await api('POST', '/workflows', {
  name: 'prisbel-temp-inbox (apagar)', settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'W', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
      parameters: { httpMethod: 'POST', path: p, responseMode: 'lastNode' } },
    { name: 'H', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, 0],
      onError: 'continueRegularOutput',
      parameters: { method: '={{ $json.body.metodo || "POST" }}', url: '={{ $json.body.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'gmailOAuth2',
        sendBody: '={{ ($json.body.metodo || "POST") === "POST" }}', specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.body.corpo || {}) }}',
        options: { response: { response: { neverError: true, fullResponse: true } } } },
      credentials: { gmailOAuth2: { id: 'WhxkPdGziEvCRIqD', name: 'Gmail ssysbot' } } },
  ],
  connections: { W: { main: [[{ node: 'H', type: 'main', index: 0 }]] } },
});
await api('POST', `/workflows/${wf.id}/activate`);
const call = async (url, corpo, metodo) => {
  const r = await fetch(`${env.N8N_BASE_URL}/webhook/${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, corpo, metodo }) });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 400) }; }
};
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// o nó HTTP está em fullResponse (para expor erro da API); desembrulha o corpo
const corpoDe = (r) => (r && r.body !== undefined ? r.body : r) || {};

const inserir = async ({ de, nome, assunto, corpo }) => {
  // cabeçalhos mínimos de um e-mail real; charset utf-8 para acento não virar lixo
  const raw = [
    `From: ${nome ? `${nome} <${de}>` : de}`,
    `To: ${CAIXA_BELLA}`,
    `Subject: ${assunto}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@teste.local>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '', corpo,
  ].join('\r\n');
  // users.messages.insert = POST na COLEÇÃO /messages (não existe /messages/insert)
  return call('https://gmail.googleapis.com/gmail/v1/users/me/messages?internalDateSource=dateHeader',
    { raw: b64url(raw), labelIds: ['INBOX', 'UNREAD'] });
};

try {
  if (process.argv.includes('--teste')) {
    // sonda: só verifica se a credencial tem escopo de insert; assunto fora do
    // filtro do WF5 (sem a palavra "Cotacao") para não disparar nada.
    const r = corpoDe(await inserir({
      de: 'sonda@teste.local', nome: 'Sonda',
      assunto: 'PING sonda de escopo (ignorar)',
      corpo: 'Mensagem de teste do harness. Pode apagar.',
    }));
    if (r.id) {
      console.log('OK: insert funciona (id ' + r.id + ') — apagando a sonda...');
      const d = corpoDe(await call(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.id}/trash`, {}));
      console.log('sonda para o lixo:', d.id ? 'ok' : JSON.stringify(d).slice(0, 200));
    } else {
      console.log('FALHOU:', JSON.stringify(r).slice(0, 500));
    }
  } else {
    const de = arg('de'); const pedido = arg('pedido'); const corpo = arg('corpo');
    const nome = arg('nome', '');
    const assunto = arg('assunto', `Re: Cotacao - Pedido ${pedido} - Prisbel Construtora`);
    if (!de || !pedido || !corpo) {
      console.error('faltou --de=, --pedido= ou --corpo=');
      process.exit(1);
    }
    const r = corpoDe(await inserir({ de, nome, assunto, corpo }));
    console.log(r.id ? `inserido: ${r.id} | de ${de} | "${assunto}"` : 'ERRO: ' + JSON.stringify(r).slice(0, 400));
  }
} finally {
  await api('POST', `/workflows/${wf.id}/deactivate`);
  await api('DELETE', `/workflows/${wf.id}`);
}
