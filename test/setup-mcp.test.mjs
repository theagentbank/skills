import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupScript = path.join(
  root,
  'skills',
  'agentbank-pay',
  'scripts',
  'setup-mcp.mjs',
);

const fakeClient = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const client = process.env.FAKE_CLIENT || path.basename(process.argv[1]);
const args = process.argv.slice(2);
const stateFile = process.env.FAKE_STATE;
const auditFile = process.env.FAKE_AUDIT;
const readState = () => fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
if (args[0] === 'mcp' && args[1] === 'get') {
  const state = readState();
  if (!state) {
    process.stderr.write('No MCP server named "agentbank".');
    process.exit(1);
  }
  if (client === 'codex') {
    process.stdout.write(JSON.stringify({
      name: 'agentbank',
      transport: { type: 'stdio', command: state.command, args: state.args, env: state.env }
    }));
  } else {
    process.stdout.write([
      'agentbank:',
      '  Scope: User config',
      '  Type: stdio',
      '  Command: ' + state.command,
      '  Args: ' + state.args.join(' '),
      '  Environment: ' + Object.entries(state.env).map(([key, value]) => key + '=' + value).join(', ')
    ].join('\\n'));
  }
  process.exit(0);
}
if (args[0] === 'mcp' && args[1] === 'add') {
  fs.writeFileSync(auditFile, JSON.stringify(args));
  fs.writeFileSync(stateFile, JSON.stringify({
    command: 'npx',
    args: ['-y', 'agent-bank-mcp@latest'],
    env: {}
  }));
  process.exit(0);
}
process.exit(9);
`;

async function fixture(client, state = null) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agentbank-skill-'));
  fixtures.push(directory);
  const bin = path.join(directory, 'bin');
  await mkdir(bin);
  const fakeScript = path.join(bin, 'fake-client.cjs');
  const executable = path.join(
    bin,
    process.platform === 'win32' ? `${client}.cmd` : client,
  );
  const stateFile = path.join(directory, 'state.json');
  const auditFile = path.join(directory, 'audit.json');
  if (process.platform === 'win32') {
    await writeFile(fakeScript, fakeClient.replace(/^#![^\n]+\n/, ''));
    await writeFile(
      executable,
      `@echo off\r\n"${process.execPath}" "${fakeScript}" %*\r\n`,
    );
  } else {
    await writeFile(executable, fakeClient);
    await chmod(executable, 0o755);
  }
  if (state) await writeFile(stateFile, JSON.stringify(state));
  return { directory, bin, stateFile, auditFile };
}

function invoke(client, files, extra = []) {
  const result = spawnSync(
    process.execPath,
    [setupScript, '--client', client, '--json', ...extra],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${files.bin}${path.delimiter}${process.env.PATH}`,
        FAKE_STATE: files.stateFile,
        FAKE_AUDIT: files.auditFile,
        FAKE_CLIENT: client,
      },
    },
  );
  return { ...result, body: JSON.parse(result.stdout) };
}

const fixtures = [];
test.afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

const expected = {
  command: 'npx',
  args: ['-y', 'agent-bank-mcp@latest'],
  env: {},
};

const legacyExpected = {
  command: 'npx',
  args: ['-y', 'agent-bank-mcp@latest'],
  env: {
    PROTOCOL_BASE_URL: 'https://protocol.agentbank.world',
    APP_BASE_URL: 'https://staging.agentbank.world',
  },
};

for (const client of ['codex', 'claude']) {
  test(`${client}: exact config is a no-op`, async () => {
    const files = await fixture(client, expected);
    const result = invoke(client, files);
    assert.equal(result.status, 0);
    assert.equal(result.body.status, 'already_configured');
    await assert.rejects(readFile(files.auditFile));
  });

  test(`${client}: missing config is added and verified`, async () => {
    const files = await fixture(client);
    const result = invoke(client, files);
    assert.equal(result.status, 0);
    assert.equal(result.body.status, 'configured');
    const args = JSON.parse(await readFile(files.auditFile, 'utf8'));
    assert.deepEqual(
      args.slice(-4),
      ['--', 'npx', '-y', 'agent-bank-mcp@latest'],
    );
    assert.doesNotMatch(args.join(' '), /(?:--env|-e)(?:\s|$)/);
    if (client === 'claude') {
      assert.deepEqual(args.slice(0, 5), [
        'mcp',
        'add',
        '--scope',
        'user',
        'agentbank',
      ]);
    } else {
      assert.deepEqual(args.slice(0, 3), ['mcp', 'add', 'agentbank']);
    }
  });

  test(`${client}: former exact endpoint overrides remain compatible`, async () => {
    const files = await fixture(client, legacyExpected);
    const result = invoke(client, files);
    assert.equal(result.status, 0);
    assert.equal(result.body.status, 'already_configured');
    await assert.rejects(readFile(files.auditFile));
  });

  test(`${client}: additional legacy environment values remain a conflict`, async () => {
    const files = await fixture(client, {
      ...legacyExpected,
      env: { ...legacyExpected.env, EXTRA_SETTING: 'unexpected' },
    });
    const result = invoke(client, files);
    assert.equal(result.status, 2);
    assert.equal(result.body.status, 'conflict');
    await assert.rejects(readFile(files.auditFile));
  });

  test(`${client}: altered endpoint overrides remain a conflict`, async () => {
    const files = await fixture(client, {
      ...legacyExpected,
      env: {
        ...legacyExpected.env,
        APP_BASE_URL: 'https://app.example.test',
      },
    });
    const result = invoke(client, files);
    assert.equal(result.status, 2);
    assert.equal(result.body.status, 'conflict');
    await assert.rejects(readFile(files.auditFile));
  });

  test(`${client}: check mode reports missing without writing`, async () => {
    const files = await fixture(client);
    const result = invoke(client, files, ['--check']);
    assert.equal(result.status, 0);
    assert.equal(result.body.status, 'missing');
    await assert.rejects(readFile(files.auditFile));
  });

  test(`${client}: a conflicting config is never overwritten`, async () => {
    const files = await fixture(client, {
      command: 'node',
      args: ['unrelated.js'],
      env: { SECRET: 'must-not-be-printed' },
    });
    const result = invoke(client, files);
    assert.equal(result.status, 2);
    assert.equal(result.body.status, 'conflict');
    assert.deepEqual(result.body.current.env_keys, ['SECRET']);
    assert.doesNotMatch(result.stdout, /must-not-be-printed/);
    await assert.rejects(readFile(files.auditFile));
  });
}

test('missing client CLI is reported distinctly', () => {
  const result = spawnSync(
    process.execPath,
    [setupScript, '--client', 'codex', '--json'],
    {
      encoding: 'utf8',
      env: { ...process.env, PATH: '' },
    },
  );
  assert.equal(result.status, 3);
  assert.equal(JSON.parse(result.stdout).status, 'client_unavailable');
});
