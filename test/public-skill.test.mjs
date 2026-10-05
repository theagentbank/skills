import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { comparePublicSkill } from '../scripts/check-public-skill.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('public skill check accepts identical bytes', async () => {
  const local = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'));
  assert.deepEqual(comparePublicSkill(Buffer.from(local), local), []);
});

test('public skill check rejects any byte difference with both hashes', async () => {
  const local = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'));
  const changed = Buffer.concat([local, Buffer.from('\n')]);
  const errors = comparePublicSkill(changed, local);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /differs from dist\/agentbank-pay\/SKILL\.md \(sha256 [0-9a-f]{64}/);
});
