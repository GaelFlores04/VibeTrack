import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupError } from '../src/common/startup-error';

test('arranque encuentra TLS anidado sin imprimir topología ni credenciales', () => {
  const error = { reason: { servers: new Map([['servidor-privado', { error: { cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', message: 'contraseña privada' } } }]]) } };
  const message = startupError(error);
  assert.match(message, /TLS.*MongoDB/); assert.match(message, /IP actual.*Network Access/);
  assert.ok(!message.includes('contraseña privada') && !message.includes('servidor-privado'));
});

test('arranque distingue puerto ocupado, DNS y configuración, sin revelar secretos', () => {
  assert.match(startupError({ code: 'EADDRINUSE' }), /puerto.*ocupado/);
  assert.match(startupError({ cause: { code: 'ENOTFOUND' } }), /DNS/);
  assert.match(startupError(new Error('PORT inválido.')), /PORT inválido/);
  assert.ok(!startupError(new Error('https://example.test/?dato=confidencial')).includes('confidencial'));
  const cyclic: any = {}; cyclic.reason = cyclic;
  assert.match(startupError(cyclic), /sin detalle/);
});
