import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'sync-protocol-core.mjs');

function run(target, extra = []) {
  return spawnSync(
    process.execPath,
    [script, '--target', target, ...extra],
    { encoding: 'utf8' },
  );
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agentbank-protocol-sync-'));
  await mkdir(path.join(directory, 'mcp-agent-server'), { recursive: true });
  await writeFile(
    path.join(directory, 'mcp-agent-server', 'package.json'),
    `${JSON.stringify({ name: 'agent-bank-mcp' }, null, 2)}\n`,
  );
  const git = spawnSync('git', ['init', '-q'], { cwd: directory, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  return directory;
}

test('sync writes only the compatibility skill and supports drift checks', async (context) => {
  const target = await fixture();
  context.after(() => rm(target, { recursive: true, force: true }));

  const first = run(target);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Synced compatibility skill/);

  const check = run(target, ['--check']);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /already synchronized/);

  const skill = path.join(
    target,
    'mcp-agent-server',
    'skills',
    'agentbank-pay',
    'SKILL.md',
  );
  assert.doesNotMatch(
    await readFile(skill, 'utf8'),
    /GENERATED from theagentbank\/skills/,
  );
});

test('sync refuses to overwrite local edits unless forced', async (context) => {
  const target = await fixture();
  context.after(() => rm(target, { recursive: true, force: true }));
  assert.equal(run(target).status, 0);

  const skill = path.join(
    target,
    'mcp-agent-server',
    'skills',
    'agentbank-pay',
    'SKILL.md',
  );
  await writeFile(skill, 'local maintainer edit\n');

  const check = run(target, ['--check']);
  assert.equal(check.status, 1);
  assert.match(check.stderr, /Compatibility drift detected/);

  const refused = run(target);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Refusing to overwrite locally modified/);

  const forced = run(target, ['--force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.doesNotMatch(
    await readFile(skill, 'utf8'),
    /GENERATED from theagentbank\/skills/,
  );
});
