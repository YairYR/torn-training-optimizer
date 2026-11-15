// Las funciones de /api corren como ESM en Node: cada import relativo de valor
// necesita la extensión .js, también los transitivos (src/...). Sin ella el
// deploy compila pero la función cae al primer request — pasó dos veces.
// Corre antes de los tests (npm test) y en CI.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = resolve(dirname(fileURLToPath(import.meta.url)), '../api');
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+'(\.[^']+)'/gm;
const seen = new Set();

function offenders(file) {
  if (seen.has(file)) return [];
  seen.add(file);
  const bad = [];
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(VALUE_IMPORT)) {
    if (!spec.endsWith('.js')) bad.push(`${file.replace(API + '/', 'api/')}: '${spec}'`);
    else bad.push(...offenders(resolve(dirname(file), spec.replace(/\.js$/, '.ts'))));
  }
  return bad;
}

const bad = readdirSync(API)
  .filter((f) => f.endsWith('.ts'))
  .flatMap((f) => offenders(resolve(API, f)));
if (bad.length) {
  console.error('Imports sin .js alcanzables desde /api (fallan en el runtime de Vercel):\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`api imports OK (${seen.size} files)`);
