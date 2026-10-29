import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export function parseCredentials(input: Record<string, unknown>) {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (password.length < 12 || password.length > 128) return null;
  return { email, password };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt-v1:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string | null) {
  // Unknown users still incur the same password derivation cost.
  const fallback = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`;
  const [version, salt, encoded] = (hash ?? fallback).split(":");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(encoded ?? "")) return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(encoded, "hex")) && hash !== null;
}
