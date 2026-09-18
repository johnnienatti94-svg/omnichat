/**
 * AES-256-GCM Symmetric Encryption Module
 * Compatible with Cloudflare Workers, Node.js 20+, and modern Edge runtimes.
 */

const DEFAULT_MASTER_KEY = 'meepro_master_encryption_key_2026_secure!';

async function deriveKey(masterSecret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawSecret = enc.encode(masterSecret.padEnd(32, '0').slice(0, 32));

  return crypto.subtle.importKey(
    'raw',
    rawSecret,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a sensitive string (e.g., access token, API secret) with AES-256-GCM.
 * Output format: "<iv_hex>:<ciphertext_hex>"
 */
export async function encryptToken(plainText: string, masterKey = DEFAULT_MASTER_KEY): Promise<string> {
  if (!plainText) return '';

  const enc = new TextEncoder();
  const data = enc.encode(plainText);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterKey);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const cipherHex = Array.from(new Uint8Array(encryptedBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${ivHex}:${cipherHex}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 */
export async function decryptToken(encryptedString: string, masterKey = DEFAULT_MASTER_KEY): Promise<string> {
  if (!encryptedString || !encryptedString.includes(':')) {
    return encryptedString; // Return as-is if unencrypted or empty
  }

  const [ivHex, cipherHex] = encryptedString.split(':');
  if (!ivHex || !cipherHex) return encryptedString;

  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
  const cipherData = new Uint8Array(cipherHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
  const key = await deriveKey(masterKey);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherData
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed, possible tampered data or wrong key:', err);
    return '';
  }
}

/**
 * Masks sensitive access tokens for safe frontend transmission (Zero Token Leak).
 * Example: "EAAB...xyz123" -> "EAAB••••••••xyz123"
 */
export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}
