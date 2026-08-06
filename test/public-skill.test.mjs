import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256, validatePublicSkill } from '../scripts/check-public-skill.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generated public skill is self-contained and has immutable provenance', async () => {
  const skill = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'), 'utf8');
  const manifest = {
    source: 'https://github.com/theagentbank/skills',
    skill: 'agentbank-pay',
    release: 'v1.3.0',
    sourceCommit: 'a'.repeat(40),
    sha256: sha256(skill),
  };
  assert.deepEqual(validatePublicSkill(skill, manifest), []);
});

test('public skill checker rejects unavailable bootstrap dependencies', async () => {
  const skill = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'), 'utf8');
  const errors = validatePublicSkill(skill.replace('codex mcp get agentbank --json', '<skill-directory>'), {
    source: 'https://github.com/theagentbank/skills',
    skill: 'agentbank-pay',
    release: 'main',
    sourceCommit: 'invalid',
    sha256: 'invalid',
  });
  assert.match(errors.join('\n'), /unavailable local skill-directory placeholder/);
  assert.match(errors.join('\n'), /immutable version label/);
  assert.match(errors.join('\n'), /sha256 does not match/);
});
