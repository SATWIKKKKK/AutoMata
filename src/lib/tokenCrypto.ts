import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const raw = (process.env.ENCRYPTION_KEY ?? '').trim();
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not configured.');
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const utf8 = Buffer.from(raw, 'utf8');
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error('ENCRYPTION_KEY must be a 64-char hex string or a 32-byte string.');
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText.startsWith('enc:v1:')) {
    // Backward compatibility with legacy plaintext rows.
    return cipherText;
  }

  const [, , ivB64, tagB64, payloadB64] = cipherText.split(':');
  if (!ivB64 || !tagB64 || !payloadB64) {
    throw new Error('Invalid encrypted token format.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const payload = Buffer.from(payloadB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
}
