#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLegacy } from './legacy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = { target: path.join(repoRoot, '..', 'protocol-core'), check: false, force: false };
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--target') {
    if (!args[index + 1]) throw new Error('--target requires a path');
    options.target = args[++index];
  } else if (arg === '--check') options.check = true;
  else if (arg === '--force') options.force = true;
  else throw new Error(`Unknown argument: ${arg}`);
}
if (options.check && options.force) {
  throw new Error('--check and --force cannot be combined');
}

const target = path.resolve(options.target);
const packageFile = path.join(target, 'mcp-agent-server', 'package.json');
await access(packageFile).catch(() => {
  throw new Error(`Not a protocol-core checkout: ${target}`);
});
const targetPackage = JSON.parse(await readFile(packageFile, 'utf8'));
if (targetPackage.name !== 'agent-bank-mcp') {
  throw new Error(`Unexpected MCP package in protocol-core target: ${targetPackage.name}`);
}

const destination = path.join(
  target,
  'mcp-agent-server',
  'skills',
  'agentbank-pay',
);
const outputs = [
  {
    relative: 'mcp-agent-server/skills/agentbank-pay/SKILL.md',
    absolute: path.join(destination, 'SKILL.md'),
    content: await renderLegacy(repoRoot),
  },
  {
    relative: 'mcp-agent-server/skills/agentbank-pay/agents/openai.yaml',
    absolute: path.join(destination, 'agents', 'openai.yaml'),
    content: await readFile(
      path.join(repoRoot, 'skills', 'agentbank-pay', 'agents', 'openai.yaml'),
      'utf8',
    ),
  },
];

async function current(output) {
  try {
    return await readFile(output.absolute, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const mismatches = [];
for (const output of outputs) {
  if ((await current(output)) !== output.content) mismatches.push(output);
}
if (mismatches.length === 0) {
  process.stdout.write(`Compatibility skill is already synchronized at ${destination}\n`);
  process.exit(0);
}
if (options.check) {
  process.stderr.write(
    `Compatibility drift detected:\n${mismatches.map((item) => `- ${item.relative}`).join('\n')}\n`,
  );
  process.exit(1);
}

const status = spawnSync(
  'git',
  ['-C', target, 'status', '--porcelain', '--', ...outputs.map((item) => item.relative)],
  { encoding: 'utf8', shell: false },
);
if (status.error || status.status !== 0) {
  throw new Error(status.stderr?.trim() || 'Unable to inspect protocol-core worktree');
}
if (status.stdout.trim() && !options.force) {
  throw new Error(
    'Refusing to overwrite locally modified compatibility files. Review them, then rerun with --force if replacement is intentional.',
  );
}

for (const output of outputs) {
  await mkdir(path.dirname(output.absolute), { recursive: true });
  await writeFile(output.absolute, output.content);
}
process.stdout.write(`Synced compatibility skill to ${destination}\n`);
