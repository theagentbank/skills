import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderLegacy } from '../scripts/legacy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('legacy export is deterministic and self-contained', async () => {
  const first = await renderLegacy(root);
  const second = await renderLegacy(root);
  assert.equal(first, second);
  assert.match(first, /GENERATED from theagentbank\/skils/);
  assert.match(first, /# Setup and onboarding/);
  assert.match(first, /# Payments and tracking/);
  assert.doesNotMatch(first, /\]\(references\//);
});

test('tracked legacy artifact matches canonical sources', async () => {
  const tracked = await readFile(
    path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'),
    'utf8',
  );
  assert.equal(tracked, await renderLegacy(root));
});
