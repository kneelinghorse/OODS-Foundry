const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // app directory
const STORIES = path.join(ROOT, 'apps', 'explorer', 'src', 'stories');
const exts = new Set(['.mdx', '.tsx', '.ts', '.jsx', '.js']);
let changed = 0;

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
    else if (exts.has(path.extname(entry.name))) {
      const src = fs.readFileSync(fp, 'utf8');
      const next = src
        // context: normalize lowercase → TitleCase for allowed values
        .replace(/(context:\s*['"])timeline(['"])/gi, '$1Timeline$2')
        .replace(/(context:\s*['"])detail(['"])/gi, '$1Detail$2')
        .replace(/(context:\s*['"])list(['"])/gi, '$1List$2')
        .replace(/(context:\s*['"])form(['"])/gi, '$1Form$2')
        // title: 'Context/timeline' → 'Context/Timeline'
        .replace(/(title:\s*['"]Context\/)timeline(['"])/gi, '$1Timeline$2')
        .replace(/(title:\s*['"]Context\/)detail(['"])/gi, '$1Detail$2')
        .replace(/(title:\s*['"]Context\/)list(['"])/gi, '$1List$2')
        .replace(/(title:\s*['"]Context\/)form(['"])/gi, '$1Form$2');
      if (next !== src) {
        fs.writeFileSync(fp, next, 'utf8');
        changed++;
      }
    }
  }
}
if (fs.existsSync(STORIES)) walk(STORIES);
console.log(`normalize-contexts: updated ${changed} files`);
process.exit(0);

