import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const code = ts.transpileModule(fs.readFileSync('src/lib/passwords.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require, Buffer });
const { hashPassword, verifyPassword, parseCredentials } = exportsObject;

test('normalizes email without altering password; rejects invalid inputs', () => {
  const input = parseCredentials({ email: '  Trader@Example.com ', password: ' secure password ' });
  assert.equal(input.email, 'trader@example.com');
  assert.equal(input.password, ' secure password ');
  for (const value of [
    { email: 'bad', password: 'long password' },
    { email: 'user@example.com', password: 'short' },
    { email: 'user@example.com', password: 'a'.repeat(129) },
    { email: { value: 'user@example.com' }, password: 'long password' },
    { email: 'user@example.com', password: 123456789012 },
  ]) assert.equal(parseCredentials(value), null);
});

test('password hashes use unique salts and verify only the original password', async () => {
  const password = 'a long test password';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  assert.equal(await verifyPassword(password, 'scrypt-v1:bad:bad'), false);
});
