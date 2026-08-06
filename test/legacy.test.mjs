import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderLegacy } from '../scripts/legacy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('legacy export is deterministic and self-contained', async () => {
  const first = await renderLegacy(root);
  const second = await renderLegacy(root);
  assert.equal(first, second);
  assert.match(first, /GENERATED from theagentbank\/skills/);
  assert.match(first, /# Setup and onboarding/);
  assert.match(first, /# Payments and tracking/);
  assert.match(first, /codex mcp get agentbank --json/);
  assert.match(first, /codex mcp add agentbank -- npx -y agent-bank-mcp@latest/);
  assert.match(first, /After browser approval, call `whoami`, restart/);
  assert.match(first, /CREDENTIAL_STORE_CORRUPT/);
  assert.doesNotMatch(first, /<skill-directory>/);
  assert.doesNotMatch(first, /\]\(references\//);
  assert.ok(first.split(/\r?\n/).length <= 500);
});

test('tracked legacy artifact matches canonical sources', async () => {
  const tracked = await readFile(
    path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'),
    'utf8',
  );
  assert.equal(tracked, await renderLegacy(root));
});

test('legacy export accepts CRLF canonical sources', async (context) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'agentbank-legacy-crlf-'));
  context.after(() => rm(fixture, { recursive: true, force: true }));
  const source = path.join(root, 'skills', 'agentbank-pay');
  const target = path.join(fixture, 'skills', 'agentbank-pay');
  await mkdir(path.join(target, 'references'), { recursive: true });

  for (const relative of [
    'SKILL.md',
    'references/onboarding.md',
    'references/identity.md',
    'references/payments.md',
    'references/recipients-wallets.md',
    'references/recovery.md',
  ]) {
    const content = await readFile(path.join(source, relative), 'utf8');
    await writeFile(path.join(target, relative), content.replace(/\n/g, '\r\n'));
  }

  assert.equal(await renderLegacy(fixture), await renderLegacy(root));
});
