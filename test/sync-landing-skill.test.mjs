import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../scripts/check-public-skill.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'sync-landing-skill.mjs');

test('landing sync records an immutable release label and exact content hash', async (context) => {
  const target = await mkdtemp(path.join(os.tmpdir(), 'agentbank-landing-sync-'));
  context.after(() => rm(target, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script, '--target', target], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: 'b'.repeat(40), GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main' },
  });
  assert.equal(result.status, 0, result.stderr);

  const skill = await readFile(path.join(target, 'public', 'SKILL.md'), 'utf8');
  const manifest = JSON.parse(
    await readFile(path.join(target, 'public', 'agentbank-pay.manifest.json'), 'utf8'),
  );
  assert.equal(manifest.release, 'v1.4.0');
  assert.equal(manifest.sourceCommit, 'b'.repeat(40));
  assert.equal(manifest.sha256, sha256(skill));
});
