/**
 * Web Crypto HMAC-SHA256 Signature Verifier
 * Compatible with Cloudflare Workers, Node.js 20+, and modern Edge runtimes.
 */

export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string equality check to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies Meta Graph API (Facebook / Instagram) Webhook signature (X-Hub-Signature-256).
 * Format: "sha256=<hex_hash>"
 */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedHash = parts[1].toLowerCase().trim();
  const computedHash = (await computeHmacSha256Hex(appSecret, rawBody)).toLowerCase();

  return timingSafeEqual(expectedHash, computedHash);
}

/**
 * Verifies TikTok Shop Webhook signature.
 * Format: Hex or Base64 HMAC-SHA256 of rawBody.
 */
export async function verifyTikTokShopSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const cleanHeader = signatureHeader.replace(/^sha256=/, '').toLowerCase().trim();
  const computedHash = (await computeHmacSha256Hex(appSecret, rawBody)).toLowerCase();

  return timingSafeEqual(cleanHeader, computedHash);
}

/**
 * Computes HMAC-SHA256 and returns Base64 string.
 */
export async function computeHmacSha256Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(signatureBuffer).toString('base64');
  }
  const bytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Verifies LINE Official Account Webhook signature (x-line-signature).
 * LINE uses HMAC-SHA256 algorithm with Channel Secret, output as a Base64-encoded string.
 */
export async function verifyLineSignature(
  rawBody: string,
  signatureHeader: string | null,
  channelSecret: string
): Promise<boolean> {
  if (!signatureHeader || !channelSecret) {
    return false;
  }

  const expectedSignature = signatureHeader.trim();
  const computedSignature = await computeHmacSha256Base64(channelSecret, rawBody);

  return timingSafeEqual(expectedSignature, computedSignature);
}

