const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { basename } = require('node:path');
// Se inspecciona solo código versionable; nunca se abre un archivo de secretos.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0');
let failed = false;
for (const file of new Set(files)) {
  if (!file || !existsSync(file) || basename(file).startsWith('.env') || file.endsWith('package-lock.json')) continue;
  if (!/\.(?:[cm]?[jt]sx?|json|md|yml|yaml|txt|html|css)$/.test(file)) continue;
  const value = readFileSync(file, 'utf8');
  if (/mongodb(?:\+srv)?:\/\/[^\s/:]+:[^\s@]+@/i.test(value) || /(?<![a-f\d])[a-f\d]{32,}(?![a-f\d])/i.test(value)) {
    console.error(`Posible secreto en ${file}; revisarlo sin publicar su contenido.`); failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log('Revisión de secretos: sin coincidencias.');
