// Exporta os workflows vivos do n8n via API pública.
// Uso: node scripts/export_workflows.mjs
// Requer .env com N8N_API_KEY e N8N_BASE_URL.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env parser mínimo (sem dependências)
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const { N8N_API_KEY, N8N_BASE_URL } = env;
if (!N8N_API_KEY) { console.error('N8N_API_KEY ausente no .env'); process.exit(1); }

// IDs vivos (ver CLAUDE.md)
const WORKFLOWS = {
  'WF3 - Triagem de Pedidos': 'aBz2S5IDxRxNmhY6',
  'WF6 - Bella WhatsApp': 'ZFNaiej2sEx8QjTa',
  'WF4 - Painel Daniela': '7WbHA7BoeLnrdw1Z',
  'Router uazapi': '1ne4HxkRBgp8gQXy',
  'WF2 - Recepcao Locacoes': 'Hldu4XJLXikGK3Io',
  'WF1 - Alerta Diario': 'Ji4IgetwZB8QEntO',
};

const stamp = new Date().toISOString().slice(0, 10);
const outDir = join(root, 'workflows', `export-${stamp}`);
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const [name, id] of Object.entries(WORKFLOWS)) {
  const url = `${N8N_BASE_URL}/api/v1/workflows/${id}`;
  try {
    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const wf = await res.json();
    const file = join(outDir, `${name} (${wf.active ? 'ATIVO' : 'inativo'}).json`);
    writeFileSync(file, JSON.stringify(wf, null, 2));
    console.log(`ok  ${name}  active=${wf.active}  nodes=${wf.nodes?.length}`);
  } catch (e) {
    failed++;
    console.error(`ERRO ${name} (${id}): ${e.message}`);
  }
}
console.log(`\nExport em ${outDir}${failed ? ` — ${failed} falha(s)` : ''}`);
process.exit(failed ? 1 : 0);
