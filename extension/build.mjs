// Package the Clonyfy Helper for the Chrome Web Store / Edge Add-ons: `node extension/build.mjs`
// Output: extension/dist/clonyfy-helper-<version>.zip (upload this file to the store).
import { copyFileSync, createWriteStream, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'backend', 'package.json'));
const archiver = require('archiver');
const { version } = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const FILES = ['manifest.json', 'background.js', 'bridge.js', 'sanitize.js', 'allow.html', 'allow.js', 'popup.html', 'ui.css',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'];

mkdirSync(join(here, 'dist'), { recursive: true });
const outPath = join(here, 'dist', `clonyfy-helper-${version}.zip`);
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(createWriteStream(outPath));
for (const f of FILES) zip.file(join(here, f), { name: f });
await zip.finalize();
await new Promise((r) => setTimeout(r, 300));
// Also served by the web app as the download fallback until the store listing is live.
copyFileSync(outPath, join(here, '..', 'frontend', 'public', 'clonyfy-helper.zip'));
console.log(`Wrote ${outPath} (+ frontend/public/clonyfy-helper.zip)`);
