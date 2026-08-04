#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonical = path.join(root, 'skills', 'agentbank-pay');
const npx = 'npx';
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const clients = [
  {
    agent: 'codex',
    installed: path.join('.agents', 'skills', 'agentbank-pay'),
  },
  {
    agent: 'claude-code',
    installed: path.join('.claude', 'skills', 'agentbank-pay'),
  },
];

function run(command, args, cwd) {
  const options = {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  };
  const result =
    process.platform === 'win32' && command === 'npx'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', command, ...args],
          options,
        )
      : spawnSync(command, args, options);
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      `${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`,
      { cause: result.error },
    );
  }
}

async function listFiles(directory, current = directory) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(directory, absolute)));
    else if (entry.isFile()) files.push(path.relative(directory, absolute));
  }
  return files.sort();
}

async function verifyCopy(actual) {
  const expectedFiles = await listFiles(canonical);
  const actualFiles = await listFiles(actual);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `Installed file set differs. Expected ${expectedFiles.join(', ')}; received ${actualFiles.join(', ')}`,
    );
  }
  for (const relative of expectedFiles) {
    const [expected, received] = await Promise.all([
      readFile(path.join(canonical, relative)),
      readFile(path.join(actual, relative)),
    ]);
    if (!expected.equals(received)) {
      throw new Error(`Installed ${relative} differs from the source skill`);
    }
  }
}

for (const client of clients) {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'agentbank-skills-install-'));
  try {
    run(git, ['init', '-q'], fixture);
    run(
      npx,
      [
        '-y',
        'skills@1.5.21',
        'add',
        root,
        '--agent',
        client.agent,
        '--skill',
        'agentbank-pay',
        '--copy',
        '-y',
      ],
      fixture,
    );
    await verifyCopy(path.join(fixture, client.installed));
    process.stdout.write(`Verified clean ${client.agent} installation\n`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}
