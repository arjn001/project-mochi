// Keeps secrets away from AIs. Plain code with no VS Code dependency.

// Files that usually hold secrets. Nothing from these is ever shared.
const SENSITIVE_FILES: RegExp[] = [
  /^\.env(\..+)?$/i, // .env, .env.local, .env.production
  /\.(pem|key|p12|pfx|keystore|jks)$/i, // certificates and private keys
  /^id_(rsa|dsa|ecdsa|ed25519)$/i, // SSH private keys (the .pub halves are fine)
];

export function isSensitiveFile(fileName: string): boolean {
  return SENSITIVE_FILES.some((pattern) => pattern.test(fileName));
}

export function refusalFor(fileName: string): string {
  return `Mochi doesn't share anything from ${fileName}, since files like it usually hold secrets.`;
}

// Text that looks like a password or API key. Only a warning: she can still
// choose to share, since code about passwords isn't always a password.
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-(ant-)?[A-Za-z0-9_-]{16,}/, // Anthropic and OpenAI style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access keys
  /\b(password|passwd|pwd|secret|api[_-]?key|token)\b\s*[:=]\s*["']?[^\s"']{6,}/i,
];

export function looksSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export const SECRET_WARNING = "Careful: this looks like it might contain a password or API key.";
