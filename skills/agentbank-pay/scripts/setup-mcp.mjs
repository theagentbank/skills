#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const EXPECTED = Object.freeze({
  name: 'agentbank',
  command: 'npx',
  args: ['-y', 'agent-bank-mcp@latest'],
  env: {},
});

const LEGACY_ENV = Object.freeze({
  PROTOCOL_BASE_URL: 'https://protocol.agentbank.world',
  APP_BASE_URL: 'https://staging.agentbank.world',
});

const EXIT = Object.freeze({
  ok: 0,
  conflict: 2,
  unavailable: 3,
  failed: 4,
});

function parseArgs(argv) {
  const result = { client: null, check: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--client') result.client = argv[++index];
    else if (arg === '--check') result.check = true;
    else if (arg === '--json') result.json = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.help && !['codex', 'claude'].includes(result.client)) {
    throw new Error('--client must be codex or claude');
  }
  return result;
}

function run(command, args, options = {}) {
  const spawnOptions = {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options,
  };
  if (process.platform !== 'win32') {
    return spawnSync(command, args, spawnOptions);
  }

  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const where = spawnSync(
    path.join(systemRoot, 'System32', 'where.exe'),
    [command],
    spawnOptions,
  );
  if (where.status !== 0) {
    const error = new Error(`${command} is not available on PATH`);
    error.code = 'ENOENT';
    return { error, status: null, stdout: '', stderr: where.stderr ?? '' };
  }
  return spawnSync(
    process.env.ComSpec ?? path.join(systemRoot, 'System32', 'cmd.exe'),
    ['/d', '/s', '/c', command, ...args],
    spawnOptions,
  );
}

function normalizeEnv(env = {}) {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, String(value)]),
  );
}

function sameCommand(config) {
  if (!config) return false;
  return (
    config.command === EXPECTED.command &&
    JSON.stringify(config.args) === JSON.stringify(EXPECTED.args)
  );
}

function exactEnv(config, expected) {
  const currentEnv = normalizeEnv(config?.env);
  const expectedEnv = normalizeEnv(expected);
  return (
    JSON.stringify(Object.keys(currentEnv).sort()) ===
      JSON.stringify(Object.keys(expectedEnv).sort()) &&
    Object.entries(expectedEnv).every(([key, value]) => currentEnv[key] === value)
  );
}

function exact(config) {
  return sameCommand(config) && exactEnv(config, EXPECTED.env);
}

function legacyCompatible(config) {
  return sameCommand(config) && exactEnv(config, LEGACY_ENV);
}

function safeCurrent(config) {
  if (!config) return null;
  return {
    command: config.command ?? null,
    args: Array.isArray(config.args) ? config.args : [],
    env_keys: Object.keys(config.env ?? {}).sort(),
  };
}

function inspectCodex() {
  const result = run('codex', ['mcp', 'get', EXPECTED.name, '--json']);
  if (result.error?.code === 'ENOENT') return { kind: 'unavailable' };
  if (result.status !== 0) return { kind: 'missing' };
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      kind: 'present',
      config: {
        command: parsed.transport?.command,
        args: parsed.transport?.args ?? [],
        env: parsed.transport?.env ?? {},
      },
    };
  } catch {
    return {
      kind: 'failed',
      message: 'Codex returned invalid JSON for the existing MCP server.',
    };
  }
}

function parseClaude(output) {
  const line = (label) => {
    const match = output.match(new RegExp(`^\\s*${label}:\\s*(.*)$`, 'mi'));
    return match?.[1]?.trim();
  };
  const env = {};
  const environmentLine = line('Environment');
  if (environmentLine) {
    for (const pair of environmentLine.split(/,\s*/)) {
      const separator = pair.indexOf('=');
      if (separator > 0) {
        env[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
      }
    }
  }
  const argsLine = line('Args') ?? '';
  return {
    command: line('Command'),
    args: argsLine === '' ? [] : argsLine.split(/\s+/),
    env,
  };
}

function inspectClaude() {
  const result = run('claude', ['mcp', 'get', EXPECTED.name]);
  if (result.error?.code === 'ENOENT') return { kind: 'unavailable' };
  if (result.status !== 0) return { kind: 'missing' };
  return { kind: 'present', config: parseClaude(result.stdout) };
}

function add(client) {
  const envArgs = Object.entries(EXPECTED.env).flatMap(([key, value]) =>
    client === 'codex' ? ['--env', `${key}=${value}`] : ['-e', `${key}=${value}`],
  );
  const args =
    client === 'codex'
      ? [
          'mcp',
          'add',
          EXPECTED.name,
          ...envArgs,
          '--',
          EXPECTED.command,
          ...EXPECTED.args,
        ]
      : [
          'mcp',
          'add',
          '--scope',
          'user',
          EXPECTED.name,
          ...envArgs,
          '--',
          EXPECTED.command,
          ...EXPECTED.args,
        ];
  return run(client, args);
}

function humanMessage(result) {
  const messages = {
    configured:
      'AgentBank MCP was configured and verified. Restart the active coding agent once, then repeat: Onboard a new agent.',
    already_configured:
      'AgentBank MCP already has the expected configuration.',
    missing:
      'AgentBank MCP is not configured. Run again without --check to add it.',
    conflict:
      'A conflicting MCP server named agentbank already exists. It was not changed.',
    client_unavailable:
      'The selected coding-agent CLI is not available on PATH.',
    command_failed: result.message ?? 'The MCP configuration command failed.',
  };
  return messages[result.status];
}

function emit(result, asJson) {
  if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${humanMessage(result)}\n`);
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    emit({ status: 'command_failed', message: error.message }, argv.includes('--json'));
    return EXIT.failed;
  }

  if (options.help) {
    process.stdout.write(
      'Usage: setup-mcp.mjs --client codex|claude [--check] [--json]\n',
    );
    return EXIT.ok;
  }

  const inspect = options.client === 'codex' ? inspectCodex : inspectClaude;
  const before = inspect();
  if (before.kind === 'unavailable') {
    emit({ status: 'client_unavailable', client: options.client }, options.json);
    return EXIT.unavailable;
  }
  if (before.kind === 'failed') {
    emit({ status: 'command_failed', message: before.message }, options.json);
    return EXIT.failed;
  }
  if (before.kind === 'present') {
    if (exact(before.config) || legacyCompatible(before.config)) {
      emit(
        { status: 'already_configured', client: options.client },
        options.json,
      );
      return EXIT.ok;
    }
    emit(
      {
        status: 'conflict',
        client: options.client,
        current: safeCurrent(before.config),
        expected: EXPECTED,
      },
      options.json,
    );
    return EXIT.conflict;
  }
  if (options.check) {
    emit({ status: 'missing', client: options.client }, options.json);
    return EXIT.ok;
  }

  const added = add(options.client);
  if (added.error?.code === 'ENOENT') {
    emit({ status: 'client_unavailable', client: options.client }, options.json);
    return EXIT.unavailable;
  }
  if (added.status !== 0) {
    emit(
      {
        status: 'command_failed',
        client: options.client,
        message: 'The client rejected the MCP configuration command.',
      },
      options.json,
    );
    return EXIT.failed;
  }

  const after = inspect();
  if (after.kind !== 'present' || !exact(after.config)) {
    emit(
      {
        status: 'command_failed',
        client: options.client,
        message: 'The MCP server was added but its configuration could not be verified.',
      },
      options.json,
    );
    return EXIT.failed;
  }
  emit({ status: 'configured', client: options.client }, options.json);
  return EXIT.ok;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
