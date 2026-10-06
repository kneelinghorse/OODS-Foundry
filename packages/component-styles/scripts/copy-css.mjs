import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
fs.copyFileSync(path.join(packageRoot, 'src/css.d.ts'), path.join(packageRoot, 'dist/css.d.ts'));
fs.copyFileSync(path.join(packageRoot, 'src/components.css'), path.join(packageRoot, 'dist/components.css'));
// s222-m02 (#2502 ruling 11): components.css imports the Switch and Dialog sheet beside it.
fs.copyFileSync(path.join(packageRoot, 'src/components-overlay.css'), path.join(packageRoot, 'dist/components-overlay.css'));
// s223-m02 (#2527 ruling 11): and the Combobox sheet.
fs.copyFileSync(path.join(packageRoot, 'src/components-combobox.css'), path.join(packageRoot, 'dist/components-combobox.css'));
// s223-m02 (#2527 ruling 10): and the SegmentedControl sheet.
fs.copyFileSync(path.join(packageRoot, 'src/components-segmented-control.css'), path.join(packageRoot, 'dist/components-segmented-control.css'));
fs.copyFileSync(
  path.join(packageRoot, 'src/components-ported.css'),
  path.join(packageRoot, 'dist/components-ported.css'),
);
fs.copyFileSync(
  path.join(packageRoot, '../../src/styles/statusables.css'),
  path.join(packageRoot, 'dist/statusables.css'),
);
