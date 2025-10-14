const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // app directory
const STORIES = path.join(ROOT, 'apps', 'explorer', 'src', 'stories');
const exts = new Set(['.mdx', '.tsx', '.ts', '.jsx', '.js']);
const ALLOWED = new Set(['List', 'Detail', 'Form', 'Timeline']);
const offenders = [];

function checkFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const re = /context:\s*['"]([^'"\n]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const ctx = m[1];
    if (!ALLOWED.has(ctx)) offenders.push(`${fp}: "${ctx}"`);
  }
}
function walk(p) {
  let entries;
  try {
    entries = fs.readdirSync(p, { withFileTypes: true });
  } catch (_err) {
    return;
  }
  for (const entry of entries) {
    const fp = path.join(p, entry.name);
    if (entry.isDirectory()) walk(fp);
    else if (exts.has(path.extname(entry.name))) checkFile(fp);
  }
}
if (fs.existsSync(STORIES)) walk(STORIES);
if (offenders.length) {
  console.error('Invalid context values found:\n' + offenders.join('\n'));
  process.exit(1);
} else {
  console.log('validate-contexts: OK');
  process.exit(0);
}

