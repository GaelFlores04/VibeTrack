const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { gzipSync } = require('node:zlib');

const directory = resolve(__dirname, '../frontend/dist');
const html = readFileSync(join(directory, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]+src="([^"]+)"/i)?.[1];
assert.ok(entry, 'No se encontró la entrada compilada de React.');
const compressed = file => gzipSync(readFileSync(join(directory, file.replace(/^\//, '')))).length;
const css = [...html.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1]);
const scene = readdirSync(join(directory, 'assets')).find(file => /^PlayerScene-.+\.js$/.test(file));
assert.ok(scene, 'La escena 3D debe seguir en un archivo diferido.');
for (const [label, bytes, budget] of [
  ['JavaScript inicial', compressed(entry), 110 * 1024],
  ['CSS', css.reduce((sum, file) => sum + compressed(file), 0), 12 * 1024],
  ['Escena 3D diferida', compressed(`assets/${scene}`), 300 * 1024],
]) {
  console.log(`${label}: ${(bytes / 1024).toFixed(1)} KiB gzip (límite ${(budget / 1024).toFixed(0)} KiB).`);
  assert.ok(bytes <= budget, `${label} supera el presupuesto de descarga; revisa los cambios antes de publicar.`);
}
