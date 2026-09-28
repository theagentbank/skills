import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig, renderLegacy } from '../scripts/legacy.mjs';
import { sha256 } from '../scripts/skill-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the portable artifact is the recorded backend file byte for byte', async () => {
  const { marker } = await loadConfig(root);
  const bytes = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'));
  assert.equal(sha256(bytes), marker.source_sha256);
});

test('reassembling the generated skill folder reproduces the backend bytes', async () => {
  const backend = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'), 'utf8');
  assert.equal(await renderLegacy(root), backend);
});
