import { test } from 'node:test';
import assert from 'node:assert/strict';
const { describeMongoError } = require('../scripts/check-services.cjs');

test('diagnostica autenticación sin imprimir detalles sensibles', () => {
  const result = describeMongoError({ code: 18, message: 'Authentication failed: contraseña-confidencial' });
  assert.match(result, /\[AUTH\]/);
  assert.ok(!result.includes('contraseña-confidencial'));
});
test('encuentra errores de DNS y permisos dentro de causas anidadas', () => {
  assert.match(describeMongoError({ cause: { code: 'ENOTFOUND' } }), /\[DNS\]/);
  assert.match(describeMongoError({ reason: { servers: new Map([['host', { error: { cause: { code: 'EACCES' } } }]]) } }), /\[PERMISSION\]/);
});
test('un timeout no afirma que la IP sea necesariamente la causa', () => {
  assert.match(describeMongoError({ name: 'MongoServerSelectionError' }), /\[NETWORK\]/);
  const cyclic: any = {}; cyclic.cause = cyclic;
  assert.match(describeMongoError(cyclic), /\[NETWORK\]/);
});
