// Extrai o jsCode dos Code nodes que montam prompts LLM para prompts/ (versionável e diffável).
// Uso: node scripts/extract_prompts.mjs [pasta-de-exports]   (default: workflows/)
// Regra da casa: fonte da verdade é o servidor n8n — rode após um export fresco.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.argv[2] ? join(root, process.argv[2]) : join(root, 'workflows');
const outRoot = join(root, 'prompts');

const PROMPT_RE = /prompt|systemInstruction|responseMimeType|generationConfig/i;
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

let count = 0;
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json'))) {
  const wf = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  const wfSlug = slug(basename(file, '.json')
    .replace(/ v\d+\.\d+.*$/, '')
    .replace(/ \((ATIVO|inativo)\)$/i, ''));
  for (const n of wf.nodes || []) {
    const code = n.parameters?.jsCode || '';
    if (!PROMPT_RE.test(code)) continue;
    const dir = join(outRoot, wfSlug);
    mkdirSync(dir, { recursive: true });
    const header = `// FONTE: ${file} → node "${n.name}" (${n.type})\n` +
      `// Extraído por scripts/extract_prompts.mjs — a fonte da verdade é o servidor n8n.\n` +
      `// ATENÇÃO: strings de prompt são double-quoted; nunca inserir " sem escape ao editar.\n\n`;
    writeFileSync(join(dir, `${slug(n.name)}.js`), header + code + '\n');
    console.log(`ok  ${wfSlug}/${slug(n.name)}.js  (${code.length} chars)`);
    count++;
  }
}
console.log(`\n${count} prompt(s) extraído(s) para ${outRoot}`);
