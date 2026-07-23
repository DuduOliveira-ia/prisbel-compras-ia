// Publica/atualiza o protótipo Bella Chat como rota no n8n (padrão WF4):
// Webhook GET → Code (token + HTML) → Respond (text/html).
// Uso: node scripts/deploy_bella_chat.mjs
// Token estável em .env (BELLA_CHAT_TOKEN; gerado no primeiro deploy).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
let envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
if (!env.BELLA_CHAT_TOKEN) {
  env.BELLA_CHAT_TOKEN = 'pb-bella-' + randomBytes(6).toString('hex');
  envText += (envText.endsWith('\n') ? '' : '\n') + `BELLA_CHAT_TOKEN=${env.BELLA_CHAT_TOKEN}\n`;
  writeFileSync(envPath, envText);
  console.log('token gerado e salvo no .env');
}
const { N8N_API_KEY, N8N_BASE_URL, BELLA_CHAT_TOKEN } = env;

const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// HTML do protótipo (arquivo é fonte; embrulha com doctype para servir standalone)
const page = '<!DOCTYPE html>\n<html lang="pt-BR">\n<meta charset="utf-8">\n' +
  readFileSync(join(root, 'painel', 'bella-chat-v0.1.html'), 'utf8') + '\n</html>';

const NEGADO = '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Bella</title>' +
  '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
  '<p>Link inválido ou incompleto. Confira o endereço com o Eduardo.</p></body></html>';

// Code node: só aspas simples em strings próprias; HTML entra via JSON.stringify (escape seguro)
const jsCode =
  `const token = ${JSON.stringify(BELLA_CHAT_TOKEN)};\n` +
  `const q = $json.query || {};\n` +
  `const ok = q.t === token;\n` +
  `const html = ok ? ${JSON.stringify(page)} : ${JSON.stringify(NEGADO)};\n` +
  `return [{ json: { html } }];\n`;

const NAME = 'WF7 - Bella Chat Prototipo';
const workflow = {
  name: NAME,
  settings: { executionOrder: 'v1' },
  nodes: [
    { name: 'Página', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
      webhookId: 'b7c00001-0000-4000-8000-000000000001',
      parameters: { httpMethod: 'GET', path: 'bella-chat', responseMode: 'responseNode', options: {} } },
    { name: 'Servir protótipo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
      parameters: { jsCode } },
    { name: 'Responder', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, 0],
      parameters: { respondWith: 'text', responseBody: '={{ $json.html }}',
        options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } } } },
  ],
  connections: {
    'Página': { main: [[{ node: 'Servir protótipo', type: 'main', index: 0 }]] },
    'Servir protótipo': { main: [[{ node: 'Responder', type: 'main', index: 0 }]] },
  },
};

// cria ou atualiza pelo nome; bounce obrigatório em update de workflow ativo
const list = await api('GET', `/workflows?name=${encodeURIComponent(NAME)}`);
const existing = list.data?.[0];
let id;
if (existing) {
  id = existing.id;
  if (existing.active) await api('POST', `/workflows/${id}/deactivate`);
  await api('PUT', `/workflows/${id}`, workflow);
  console.log('workflow atualizado:', id);
} else {
  id = (await api('POST', '/workflows', workflow)).id;
  console.log('workflow criado:', id);
}
await api('POST', `/workflows/${id}/activate`);

// smoke test: token certo e token errado
const url = `${N8N_BASE_URL}/webhook/bella-chat?t=${BELLA_CHAT_TOKEN}`;
const okRes = await fetch(url);
const okBody = await okRes.text();
const badRes = await fetch(`${N8N_BASE_URL}/webhook/bella-chat?t=errado`);
const badBody = await badRes.text();
console.log(`token certo → HTTP ${okRes.status}, contém Bella: ${okBody.includes('Sou a <em>Bella')}, bytes: ${okBody.length}`);
console.log(`token errado → HTTP ${badRes.status}, negado: ${badBody.includes('Link inválido')}`);
console.log(`\nURL: ${url}`);
