import { BadRequestException, HttpException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = 32768;
const MAX_ACTIVE = 2;
const MAX_QUEUED = 8;
let active = 0;
const queue: Array<() => void> = [];
async function acquire() {
  if (active < MAX_ACTIVE) { active++; return; }
  if (queue.length >= MAX_QUEUED) throw new HttpException('Demasiados accesos simultáneos. Reintenta en unos segundos.', 429);
  await new Promise<void>(resolve => queue.push(resolve));
}
export async function derivePassword(password: string, salt: string, cost = COST): Promise<Buffer> {
  await acquire();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 128 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key));
    });
  } finally { const next = queue.shift(); if (next) next(); else active--; }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v2:${COST}:8:1:${salt}:${(await derivePassword(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split(':');
  const modern = parts.length === 6 && parts[0] === 'scrypt-v2' && parts[1] === String(COST)
    && parts[2] === '8' && parts[3] === '1';
  const legacy = parts.length === 2;
  const salt = modern ? parts[4] : legacy ? parts[0] : 'invalid-account-dummy-salt';
  const hex = modern ? parts[5] : legacy ? parts[1] : '';
  const expected = Buffer.from(hex, 'hex');
  const actual = await derivePassword(password, salt, legacy ? 65536 : COST);
  return (modern || legacy) && expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function validatePassword(password: string, email: string) {
  const trivial = ['1234567890', 'password123', 'qwerty12345', 'contraseña123', 'password1234'];
  const normalized = password.toLowerCase();
  if (password.length < 10 || password.length > 128 || trivial.includes(normalized)
    || /^(.)\1+$/.test(password) || normalized.includes(email.toLowerCase())) {
    throw new BadRequestException('Usa una contraseña de 10 a 128 caracteres, no trivial y distinta de tu correo.');
  }
}
