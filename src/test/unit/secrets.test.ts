import * as assert from "node:assert";
import { isSensitiveFile, looksSecret } from "../../ai/secrets";

describe("secrets", () => {
  it("refuses .env and key files", () => {
    for (const name of [".env", ".env.local", ".ENV.production", "server.pem", "private.key", "cert.p12", "app.pfx", "release.keystore", "id_rsa", "id_ed25519"]) {
      assert.ok(isSensitiveFile(name), `${name} should never be shared.`);
    }
  });

  it("allows ordinary files, and public SSH keys", () => {
    for (const name of ["homework.py", "env.py", "README.md", "keys.ts", "id_rsa.pub", "environment.yml"]) {
      assert.ok(!isSensitiveFile(name), `${name} is an ordinary file.`);
    }
  });

  it("notices text that looks like a password or API key", () => {
    for (const text of [
      'API_KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwx"',
      "token: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "aws = AKIAIOSFODNN7EXAMPLE",
      "-----BEGIN RSA PRIVATE KEY-----",
      "password = 'hunter2hunter2'",
    ]) {
      assert.ok(looksSecret(text), `This should raise a warning: ${text}`);
    }
  });

  it("doesn't warn about ordinary code that only mentions passwords", () => {
    for (const text of [
      "def check_password(password):",
      "if password == input_password:",
      "print('Enter your password')",
      "tokens = text.split()",
    ]) {
      assert.ok(!looksSecret(text), `This shouldn't raise a warning: ${text}`);
    }
  });
});
