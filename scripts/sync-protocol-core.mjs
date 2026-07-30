#!/usr/bin/env node

import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLegacy } from './legacy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = path.resolve(
  targetIndex >= 0 && args[targetIndex + 1]
    ? args[targetIndex + 1]
    : path.join(repoRoot, '..', 'protocol-core'),
);
const packageFile = path.join(target, 'mcp-agent-server', 'package.json');
await access(packageFile).catch(() => {
  throw new Error(`Not a protocol-core checkout: ${target}`);
});

const destination = path.join(
  target,
  'mcp-agent-server',
  'skills',
  'agentbank-pay',
);
await mkdir(path.join(destination, 'agents'), { recursive: true });
await writeFile(path.join(destination, 'SKILL.md'), await renderLegacy(repoRoot));
await copyFile(
  path.join(repoRoot, 'skills', 'agentbank-pay', 'agents', 'openai.yaml'),
  path.join(destination, 'agents', 'openai.yaml'),
);
process.stdout.write(`Synced compatibility skill to ${destination}\n`);
