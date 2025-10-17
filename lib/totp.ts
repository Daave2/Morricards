// totp.ts
// TypeScript TOTP generator for browsers (Web Crypto API).
// Supports Base32 secrets, SHA-1/SHA-256/SHA-512, custom digits & period.

// ---------- Utility: Base32 decode ----------
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32ToUint8Array(base32: string): Uint8Array {
  // Remove padding, spaces and to upper
  const clean = base32.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const bytes: number[] = [];

  let buffer = 0;
  let bitsLeft = 0;

  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) throw new Error(`Invalid base32 character: ${ch}`);
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      const byte = (buffer >> bitsLeft) & 0xff;
      bytes.push(byte);
    }
  }
  return new Uint8Array(bytes);
}

// ---------- Utility: int -> 8-byte big-endian buffer ----------
function intTo8ByteBuffer(num: number | bigint): Uint8Array {
  // counter can be big, use BigInt for safety
  let counter = typeof num === "bigint" ? num : BigInt(Math.floor(num));
  const buf = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(counter & BigInt(0xff));
    counter >>= BigInt(8);
  }
  return buf;
}

// ---------- Core: HMAC signing ----------
async function hmacSign(
  keyBytes: Uint8Array,
  msg: Uint8Array,
  algorithm: "SHA-1" | "SHA-256" | "SHA-512"
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return new Uint8Array(sig);
}

// ---------- HOTP (counter-based) ----------
export async function generateHOTP(
  secretBase32: string,
  counter: number | bigint,
  digits = 6,
  algo: "SHA-1" | "SHA-256" | "SHA-512" = "SHA-1"
): Promise<string> {
  const key = base32ToUint8Array(secretBase32);
  const counterBuf = intTo8ByteBuffer(counter);
  const hmac = await hmacSign(key, counterBuf, algo);

  // dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const p =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  const otp = p % mod;
  return otp.toString().padStart(digits, "0");
}

// ---------- TOTP (time-based) ----------
export async function generateTOTP(
  secretBase32: string,
  options?: {
    digits?: number; // usually 6
    period?: number; // default 30 seconds
    algo?: "SHA-1" | "SHA-256" | "SHA-512";
    timestamp?: number; // milliseconds since epoch, defaults to Date.now()
  }
): Promise<{
  otp: string;
  remaining: number; // seconds remaining until this code expires
  period: number;
  epoch: number;
}> {
  const digits = options?.digits ?? 6;
  const period = options?.period ?? 30;
  const algo = options?.algo ?? "SHA-1";
  const now = options?.timestamp ?? Date.now();

  const counter = BigInt(Math.floor(now / 1000 / period));
  const otp = await generateHOTP(secretBase32, counter, digits, algo);

  const epoch = Math.floor(now / 1000);
  const elapsed = epoch % period;
  const remaining = period - elapsed;

  return { otp, remaining, period, epoch };
}

// ---------- Helper: build otpauth URL (for QR generation) ----------
export function buildOTPAuthURL(params: {
  secretBase32: string;
  accountName: string; // e.g. 'user@example.com'
  issuer?: string; // e.g. 'My App'
  algorithm?: "SHA1" | "SHA256" | "SHA512"; // label for otpauth (no hyphen)
  digits?: number;
  period?: number;
}): string {
  const url = new URL("otpauth://totp/");
  const label = encodeURIComponent(params.issuer ? `${params.issuer}:${params.accountName}` : params.accountName);
  url.pathname = `/totp/${label}`;

  const q = url.searchParams;
  q.set("secret", params.secretBase32.replace(/\s+/g, ""));
  if (params.issuer) q.set("issuer", params.issuer);
  if (params.algorithm) q.set("algorithm", params.algorithm);
  if (params.digits) q.set("digits", String(params.digits));
  if (params.period) q.set("period", String(params.period));

  return url.toString();
}

// ---------- Example usage (for browser) ----------
/*
(async () => {
  const secret = "JBSWY3DPEHPK3PXP"; // example Base32 (do NOT use in production)
  const t = await generateTOTP(secret, { digits: 6, period: 30, algo: "SHA-1" });
  console.log("TOTP:", t.otp, "expires in", t.remaining, "s");
})();
*/

// If you need an export default for bundlers:
export default {
  base32ToUint8Array,
  generateHOTP,
  generateTOTP,
  buildOTPAuthURL,
};
