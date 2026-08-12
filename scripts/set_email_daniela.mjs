// Troca o e-mail da compradora (Daniela) em TODOS os pontos de uma vez:
//   WF3 Config + filtro do Gmail Trigger · WF6 Config · WF5 aviso · WF7 cópia da cobrança
// Fonte única: EMAIL_DANIELA no .env. Uso:
//   node scripts/set_email_daniela.mjs                 (aplica o valor do .env)
//   node scripts/set_email_daniela.mjs novo@email.com  (grava no .env e aplica)
//   node scripts/set_email_daniela.mjs --dry           (só mostra o que mudaria)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const novo = args.find(a => a.includes('@'));
if (novo) {
  envText = /^EMAIL_DANIELA=/m.test(envText)
    ? envText.replace(/^EMAIL_DANIELA=.*$/m, `EMAIL_DANIELA=${novo}`)
    : envText + (envText.endsWith('\n') ? '' : '\n') + `EMAIL_DANIELA=${novo}\n`;
  if (!dry) writeFileSync(envPath, envText);
  env.EMAIL_DANIELA = novo;
}
const ALVO = env.EMAIL_DANIELA;
if (!ALVO || !ALVO.includes('@')) {
  console.error('Defina EMAIL_DANIELA no .env ou passe o endereço como argumento.');
  process.exit(1);
}
// endereços que representam a compradora e devem ser substituídos onde aparecerem
const ANTIGOS = ['oliveirae.ti@gmail.com', 'compras@grupomunizrabelo.com.br', 'suprimentosmunizrabelo@gmail.com', 'suprimentosmunizerabelo@gmail.com']
  .filter(e => e !== ALVO);

console.log(`e-mail da compradora -> ${ALVO}${dry ? '  (DRY RUN)' : ''}`);

const api = async (method, path, body) => {
  const res = await fetch(`${env.N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// --- 1. WF3 (Config + filtro do trigger) e WF6 (Config) via API ---
for (const [id, nome] of [['aBz2S5IDxRxNmhY6', 'WF3 Triagem'], ['ZFNaiej2sEx8QjTa', 'WF6 WhatsApp']]) {
  const wf = await api('GET', `/workflows/${id}`);
  let trocas = 0;
  for (const node of wf.nodes) {
    // o Gmail Trigger do WF3 filtra por remetente: a caixa da compradora precisa entrar
    if (node.parameters && node.parameters.filters && typeof node.parameters.filters.q === 'string') {
      let q = node.parameters.filters.q;
      for (const velho of ANTIGOS) q = q.split(velho).join(ALVO);
      // sem duplicar o mesmo from: se já havia dois endereços iguais
      q = q.replace(new RegExp(`(from:${ALVO.replace(/[.+]/g, '\\$&')})( OR from:${ALVO.replace(/[.+]/g, '\\$&')})+`, 'g'), '$1');
      if (q !== node.parameters.filters.q) { node.parameters.filters.q = q; trocas++; console.log(`  ${nome} / ${node.name}: filtro -> ${q}`); }
    }
    if (!node.parameters) continue;
    for (const chave of Object.keys(node.parameters)) {
      const v = node.parameters[chave];
      if (typeof v === 'string') {
        let novoV = v;
        for (const velho of ANTIGOS) novoV = novoV.split(velho).join(ALVO);
        if (novoV !== v) { node.parameters[chave] = novoV; trocas++; console.log(`  ${nome} / ${node.name}.${chave}`); }
      } else if (v && typeof v === 'object') {
        let json = JSON.stringify(v), orig = json;
        for (const velho of ANTIGOS) json = json.split(velho).join(ALVO);
        if (json !== orig) { node.parameters[chave] = JSON.parse(json); trocas++; console.log(`  ${nome} / ${node.name}.${chave}`); }
      }
    }
  }
  if (!trocas) { console.log(`  ${nome}: nada a trocar`); continue; }
  if (dry) continue;
  await api('PUT', `/workflows/${id}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
  if (wf.active) { await api('POST', `/workflows/${id}/deactivate`); await api('POST', `/workflows/${id}/activate`); }
  console.log(`  ${nome}: ${trocas} troca(s) + bounce`);
}

// --- 2. WF5 e WF7: os deploys leem EMAIL_DANIELA do .env; basta redeployar ---
if (!dry) {
  for (const s of ['deploy_wf5_cotacoes.mjs', 'deploy_bella_chat.mjs']) {
    console.log(`  rodando ${s}...`);
    execFileSync(process.execPath, [join(root, 'scripts', s)], { cwd: root, stdio: 'pipe' });
  }
  console.log('WF5 e WF7 redeployados');
}
console.log(dry ? 'DRY RUN concluído — nada foi alterado.' : 'pronto: e-mail da compradora unificado.');
