import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// El token de renovación de Spotify se guarda cifrado (AES-256-GCM). La clave sale de
// SPOTIFY_TOKEN_KEY (32 bytes en base64) o, si no existe, se deriva de JWT_SECRET con HKDF.
function key(): Buffer {
  const explicit = process.env.SPOTIFY_TOKEN_KEY?.trim();
  if (explicit) {
    const bytes = Buffer.from(explicit, 'base64');
    if (bytes.length !== 32) throw new Error('SPOTIFY_TOKEN_KEY debe ser de 32 bytes en base64.');
    return bytes;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Configura SPOTIFY_TOKEN_KEY o JWT_SECRET para cifrar tokens.');
  return Buffer.from(hkdfSync('sha256', secret, 'vibetrack', 'spotify-refresh-token', 32));
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = String(payload).split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Token cifrado no válido.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
