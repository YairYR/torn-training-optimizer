import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/background.ts'), resolve(root, 'src/popup.ts')],
  bundle: true,
  format: 'esm',
  target: 'chrome111',
  outdir: dist,
  logLevel: 'info',
});

// The gym-page overlay ships as a classic script: Chrome does not load content
// scripts as ES modules, so this one entry point is bundled as an IIFE.
await build({
  entryPoints: [resolve(root, 'src/content.ts')],
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  outdir: dist,
  logLevel: 'info',
});

// Copy static assets (manifest, popup.html, icon).
cpSync(resolve(root, 'public'), dist, { recursive: true });

console.log('Extension built to', dist);
