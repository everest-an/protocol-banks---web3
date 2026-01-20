/**
 * ProtocolBanks SDK - Cryptography Utilities
 * 
 * 安全加密工具，支持:
 * - HMAC-SHA256 签名生成和验证
 * - AES-256-GCM 加密/解密
 * - 常量时间比较 (防时序攻击)
 * - 安全随机数生成
 * - 密钥派生 (PBKDF2)
 */

import type { EncryptedEnvelope, EncryptionConfig } from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from './errors';

// ============================================================================
// Constants
// ============================================================================

/** AES-256 key size in bytes */
const AES_KEY_SIZE = 32;

/** AES-GCM IV size in bytes */
const AES_GCM_IV_SIZE = 12;

/** AES-GCM auth tag size in bytes */
const AES_GCM_TAG_SIZE = 16;

/** PBKDF2 default iterations */
const PBKDF2_ITERATIONS = 100000;

/** Salt size in bytes */
const SALT_SIZE = 16;

// ============================================================================
// Browser/Node Crypto Detection
// ============================================================================

/** Check if running in browser */
const isBrowser = typeof window !== 'undefined' && typeof window.crypto !== 'undefined';

/** Get crypto module */
function getCrypto(): Crypto {
  if (isBrowser) {
    return window.crypto;
  }
  // Node.js environment
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return nodeCrypto.webcrypto as Crypto;
}

// ============================================================================
// Random Generation
// ============================================================================

/** Generate secure random bytes */
export function randomBytes(size: number): Uint8Array {
  const crypto = getCrypto();
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Generate random hex string */
export function randomHex(size: number): string {
  return bytesToHex(randomBytes(size));
}

/** Generate random base64 string */
export function randomBase64(size: number): string {
  return bytesToBase64(randomBytes(size));
}

/** Generate UUID v4 */
export function generateUUID(): string {
  const crypto = getCrypto();
  return crypto.randomUUID();
}

/** Generate nonce for x402 (32 bytes) */
export function generateNonce(): string {
  return '0x' + randomHex(32);
}

// ============================================================================
// Encoding Utilities
// ============================================================================

/** Convert bytes to hex string */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert hex string to bytes */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert bytes to base64 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (isBrowser) {
    return btoa(String.fromCharCode(...bytes));
  }
  return Buffer.from(bytes).toString('base64');
}

/** Convert base64 to bytes */
export function base64ToBytes(base64: string): Uint8Array {
  if (isBrowser) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/** Convert string to bytes (UTF-8) */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert bytes to string (UTF-8) */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ============================================================================
// HMAC-SHA256 Signature
// ============================================================================

/** Generate HMAC-SHA256 signature */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const crypto = getCrypto();
  
  const key = await crypto.subtle.importKey(
    'raw',
    stringToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToBytes(data)
  );
  
  return bytesToHex(new Uint8Array(signature));
}

/** Generate truncated HMAC signature (16 chars) */
export async function hmacSignShort(data: string, secret: string): Promise<string> {
  const fullSignature = await hmacSign(data, secret);
  return fullSignature.substring(0, 16);
}

/** Verify HMAC-SHA256 signature (constant time) */
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await hmacSign(data, secret);
  
  // Use constant-time comparison
  return constantTimeEqual(signature, expectedSignature);
}

/** Verify truncated HMAC signature (constant time) */
export async function hmacVerifyShort(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await hmacSignShort(data, secret);
  return constantTimeEqual(signature, expectedSignature);
}

// ============================================================================
// Constant Time Comparison
// ============================================================================

/** Constant-time string comparison (prevents timing attacks) */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    b = a;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0 && a.length === b.length;
}

/** Constant-time bytes comparison */
export function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  
  return result === 0;
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/** Derive encryption key from password using PBKDF2 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const crypto = getCrypto();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBytes(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Import raw key for AES-256-GCM */
export async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  
  if (keyBytes.length !== AES_KEY_SIZE) {
    throw new ProtocolBanksError({
      code: ErrorCodes.CRYPTO_KEY_DERIVATION_FAILED,
      message: `Key must be ${AES_KEY_SIZE} bytes`,
    });
  }
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt data using AES-256-GCM */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<EncryptedEnvelope> {
  const crypto = getCrypto();
  
  const iv = randomBytes(AES_GCM_IV_SIZE);
  const plaintextBytes = stringToBytes(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData,
      tagLength: AES_GCM_TAG_SIZE * 8,
    },
    key,
    plaintextBytes
  );
  
  // In WebCrypto, the auth tag is appended to the ciphertext
  const ciphertextArray = new Uint8Array(ciphertext);
  const encryptedData = ciphertextArray.slice(0, -AES_GCM_TAG_SIZE);
  const tag = ciphertextArray.slice(-AES_GCM_TAG_SIZE);
  
  return {
    ciphertext: bytesToBase64(encryptedData),
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tag),
    algorithm: 'aes-256-gcm',
  };
}

/** Decrypt data using AES-256-GCM */
export async function decrypt(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
  additionalData?: Uint8Array
): Promise<string> {
  const crypto = getCrypto();
  
  if (envelope.algorithm !== 'aes-256-gcm') {
    throw new ProtocolBanksError({
      code: ErrorCodes.CRYPTO_DECRYPTION_FAILED,
      message: `Unsupported algorithm: ${envelope.algorithm}`,
    });
  }
  
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const tag = base64ToBytes(envelope.tag);
  
  // Combine ciphertext and tag for WebCrypto
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData,
        tagLength: AES_GCM_TAG_SIZE * 8,
      },
      key,
      combined
    );
    
    return bytesToString(new Uint8Array(plaintext));
  } catch {
    throw new ProtocolBanksError({
      code: ErrorCodes.CRYPTO_DECRYPTION_FAILED,
      message: 'Decryption failed: invalid key or corrupted data',
    });
  }
}

/** Encrypt with password (includes key derivation) */
export async function encryptWithPassword(
  plaintext: string,
  password: string,
  config?: Partial<EncryptionConfig>
): Promise<{ envelope: EncryptedEnvelope; salt: string }> {
  const salt = randomBytes(SALT_SIZE);
  const iterations = config?.iterations ?? PBKDF2_ITERATIONS;
  
  const key = await deriveKey(password, salt, iterations);
  const envelope = await encrypt(plaintext, key);
  
  return {
    envelope,
    salt: bytesToBase64(salt),
  };
}

/** Decrypt with password */
export async function decryptWithPassword(
  envelope: EncryptedEnvelope,
  password: string,
  salt: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<string> {
  const saltBytes = base64ToBytes(salt);
  const key = await deriveKey(password, saltBytes, iterations);
  return decrypt(envelope, key);
}

// ============================================================================
// SHA-256 Hash
// ============================================================================

/** Calculate SHA-256 hash */
export async function sha256(data: string): Promise<string> {
  const crypto = getCrypto();
  const hash = await crypto.subtle.digest('SHA-256', stringToBytes(data));
  return bytesToHex(new Uint8Array(hash));
}

/** Calculate SHA-256 hash of bytes */
export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const crypto = getCrypto();
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

// ============================================================================
// Payment Link Signature
// ============================================================================

/** Generate payment link signature */
export async function generatePaymentLinkSignature(
  params: {
    to: string;
    amount: string;
    token: string;
    expiry: number;
    memo?: string;
  },
  secret: string
): Promise<string> {
  // Normalize parameters
  const normalized = {
    amount: params.amount,
    expiry: params.expiry.toString(),
    memo: params.memo ?? '',
    to: params.to.toLowerCase(),
    token: params.token.toUpperCase(),
  };
  
  // Create canonical string (sorted keys)
  const dataToSign = Object.entries(normalized)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  
  return hmacSignShort(dataToSign, secret);
}

/** Verify payment link signature */
export async function verifyPaymentLinkSignature(
  params: {
    to: string;
    amount: string;
    token: string;
    expiry: number;
    memo?: string;
  },
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await generatePaymentLinkSignature(params, secret);
  return constantTimeEqual(signature, expectedSignature);
}

// ============================================================================
// Webhook Signature
// ============================================================================

/** Generate webhook signature */
export async function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const dataToSign = `${timestamp}.${payload}`;
  return hmacSign(dataToSign, secret);
}

/** Verify webhook signature */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  tolerance: number = 300 // 5 minutes
): Promise<{ valid: boolean; timestampValid: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const timestampValid = Math.abs(now - timestamp) <= tolerance;
  
  const expectedSignature = await generateWebhookSignature(payload, secret, timestamp);
  const valid = constantTimeEqual(signature, expectedSignature);
  
  return { valid: valid && timestampValid, timestampValid };
}

// ============================================================================
// Sensitive Data Protection
// ============================================================================

/** Mask sensitive string (show first/last N chars) */
export function maskSensitive(
  value: string,
  showFirst: number = 4,
  showLast: number = 4
): string {
  if (value.length <= showFirst + showLast) {
    return '*'.repeat(value.length);
  }
  
  const first = value.slice(0, showFirst);
  const last = value.slice(-showLast);
  const masked = '*'.repeat(Math.min(value.length - showFirst - showLast, 8));
  
  return `${first}${masked}${last}`;
}

/** Check if string looks like sensitive data */
export function isSensitiveData(value: string): boolean {
  const patterns = [
    /^pk_[a-z]+_[a-zA-Z0-9]+$/,     // API key
    /^sk_[a-z]+_[a-zA-Z0-9]+$/,     // API secret
    /^whsec_[a-zA-Z0-9]+$/,         // Webhook secret
    /^0x[a-fA-F0-9]{64}$/,          // Private key
    /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/, // JWT
  ];
  
  return patterns.some(pattern => pattern.test(value));
}

/** Sanitize object for logging (mask sensitive fields) */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'apiKey', 'apiSecret', 'secret', 'password', 'token',
    'accessToken', 'refreshToken', 'privateKey', 'signature',
  ];
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = typeof value === 'string' ? maskSensitive(value) : '[REDACTED]';
    } else if (typeof value === 'string' && isSensitiveData(value)) {
      result[key] = maskSensitive(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
